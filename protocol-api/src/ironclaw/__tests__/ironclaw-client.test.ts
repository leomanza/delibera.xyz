import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as crypto from 'crypto';
import { dispatchTask, probeWebhook, pollJobStatus } from '../ironclaw-client';

function expectedSignature(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('dispatchTask (v0.28.1)', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('sends payload with content field (not message)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, json: async () => ({ message_id: 'm1' }),
    });
    await dispatchTask('http://1.2.3.4:8080/webhook', 'secret', { taskId: 'abc', proposalId: 'xyz', metadata: {} });
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.content).toContain('deliberate');
    expect(body.content).toContain('task_id:abc');
    expect(body.content).toContain('proposal_id:xyz');
    expect(body.message).toBeUndefined(); // v0.28.1: 'message' is gone
  });

  it('sends X-Hub-Signature-256 header with correct HMAC', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => ({ message_id: 'm1' }) });
    await dispatchTask('http://x/webhook', 'my-secret', { taskId: 'a', proposalId: 'b', metadata: {} });
    const sentHeaders = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
    const sentBody = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body;
    expect(sentHeaders['X-Hub-Signature-256']).toBe(expectedSignature('my-secret', sentBody));
    expect(sentHeaders['X-Webhook-Secret']).toBeUndefined(); // removed in v0.28.1
  });

  it('returns message_id (not job_id) from response', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, json: async () => ({ message_id: 'msg-123', status: 'accepted' }),
    });
    const id = await dispatchTask('http://x/webhook', 's', { taskId: 'a', proposalId: 'b', metadata: {} });
    expect(id).toBe('msg-123');
  });

  it('throws on non-2xx response', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'unauthorized' });
    await expect(dispatchTask('http://x/webhook', 's', { taskId: 'a', proposalId: 'b', metadata: {} }))
      .rejects.toThrow('401');
  });
});

describe('probeWebhook (v0.28.1)', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns true on 2xx response', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });
    expect(await probeWebhook('http://x/webhook', 's')).toBe(true);
  });

  it('returns false on non-2xx', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
    expect(await probeWebhook('http://x/webhook', 's')).toBe(false);
  });

  it('returns false on network error', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await probeWebhook('http://x/webhook', 's')).toBe(false);
  });

  it('uses HMAC signature in probe request', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });
    await probeWebhook('http://x/webhook', 'probe-secret');
    const headers = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
    expect(headers['X-Hub-Signature-256']).toMatch(/^sha256=[0-9a-f]{64}$/);
  });
});

describe('pollJobStatus (v0.28.1 — removed)', () => {
  it('throws — status polling was removed in v0.28.1', async () => {
    await expect(pollJobStatus()).rejects.toThrow(/not supported on IronClaw v0\.28\.1/);
  });
});
