import { describe, it, expect, vi } from 'vitest';
import { SessionStore } from '../session-store';

function makeMockTransport(sessionId: string) {
  return {
    sessionId,
    close: vi.fn(),
  };
}
function makeMockServer() {
  return { close: vi.fn() };
}

describe('SessionStore', () => {
  it('register succeeds while under capacity, size grows', () => {
    const store = new SessionStore({ maxSessions: 2, idleTtlMs: 1000 });
    expect(store.size()).toBe(0);
    expect(store.register('s1', makeMockTransport('s1'), makeMockServer())).toBe(true);
    expect(store.size()).toBe(1);
    expect(store.register('s2', makeMockTransport('s2'), makeMockServer())).toBe(true);
    expect(store.size()).toBe(2);
  });

  it('register fails at capacity — defense against reconnect storms / DoS', () => {
    const store = new SessionStore({ maxSessions: 2, idleTtlMs: 1000 });
    store.register('s1', makeMockTransport('s1'), makeMockServer());
    store.register('s2', makeMockTransport('s2'), makeMockServer());
    const result = store.register('s3', makeMockTransport('s3'), makeMockServer());
    expect(result).toBe(false);
    // Existing sessions are untouched — we never silently evict.
    expect(store.size()).toBe(2);
    expect(store.has('s1')).toBe(true);
    expect(store.has('s2')).toBe(true);
    expect(store.has('s3')).toBe(false);
  });

  it('isAtCapacity reflects size vs max correctly', () => {
    const store = new SessionStore({ maxSessions: 1, idleTtlMs: 1000 });
    expect(store.isAtCapacity()).toBe(false);
    store.register('s1', makeMockTransport('s1'), makeMockServer());
    expect(store.isAtCapacity()).toBe(true);
  });

  it('touch updates lastActivity and returns entry; undefined for missing', () => {
    let clock = 1000;
    const store = new SessionStore({ maxSessions: 10, idleTtlMs: 60_000, now: () => clock });
    store.register('s1', makeMockTransport('s1'), makeMockServer());

    clock = 5000;
    const touched = store.touch('s1');
    expect(touched).toBeDefined();
    expect(touched!.lastActivity).toBe(5000);

    expect(store.touch('unknown')).toBeUndefined();
  });

  it('sweep removes sessions older than idleTtlMs and returns swept ids', async () => {
    let clock = 0;
    const store = new SessionStore({ maxSessions: 10, idleTtlMs: 1000, now: () => clock });

    const t1 = makeMockTransport('s1');
    const t2 = makeMockTransport('s2');
    store.register('s1', t1, makeMockServer());
    store.register('s2', t2, makeMockServer());

    // Advance past TTL for s1 but touch s2.
    clock = 800;
    store.touch('s2');

    // Now s1.lastActivity=0, s2.lastActivity=800. At t=1500, only s1 is expired.
    clock = 1500;
    const swept = store.sweep();

    expect(swept).toEqual(['s1']);
    expect(store.has('s1')).toBe(false);
    expect(store.has('s2')).toBe(true);

    // Wait one microtask for the fire-and-forget close() to run.
    await new Promise(r => setImmediate(r));
    expect(t1.close).toHaveBeenCalled();
    expect(t2.close).not.toHaveBeenCalled();
  });

  it('sweep swallows close() errors so the interval keeps running', async () => {
    let clock = 0;
    const store = new SessionStore({ maxSessions: 10, idleTtlMs: 100, now: () => clock });
    const explodingTransport = {
      sessionId: 'boom',
      close: vi.fn(() => { throw new Error('close failed'); }),
    };
    store.register('boom', explodingTransport, makeMockServer());

    clock = 1000;
    expect(() => store.sweep()).not.toThrow();
    await new Promise(r => setImmediate(r));
    // Session was still removed despite the throwing close.
    expect(store.has('boom')).toBe(false);
  });

  it('remove returns the entry and frees a slot', () => {
    const store = new SessionStore({ maxSessions: 1, idleTtlMs: 1000 });
    const t = makeMockTransport('s1');
    store.register('s1', t, makeMockServer());
    expect(store.isAtCapacity()).toBe(true);

    const removed = store.remove('s1');
    expect(removed).toBeDefined();
    expect(removed!.transport).toBe(t);
    expect(store.isAtCapacity()).toBe(false);
    expect(store.has('s1')).toBe(false);
  });

  it('uses sensible defaults when no options are supplied', () => {
    const store = new SessionStore();
    // No options; still functional. Just confirm it constructs and exposes size().
    expect(store.size()).toBe(0);
    expect(store.isAtCapacity()).toBe(false);
  });
});
