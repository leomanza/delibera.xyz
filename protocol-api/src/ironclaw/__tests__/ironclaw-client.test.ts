import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatchTask, pollJobStatus, probeWebhook } from '../ironclaw-client';

describe('dispatchTask', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('message contains activation keywords', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, json: async () => ({ job_id: 'j1' }),
    });
    await dispatchTask('http://1.2.3.4:8080/webhook', 'secret', { taskId: 'abc', proposalId: 'xyz', metadata: {} });
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.message).toContain('deliberate');
    expect(body.message).toContain('task_id:abc');
    expect(body.message).toContain('proposal_id:xyz');
  });

  it('sends X-Webhook-Secret header', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => ({ job_id: 'j1' }) });
    await dispatchTask('http://x/webhook', 'my-secret', { taskId: 'a', proposalId: 'b', metadata: {} });
    const headers = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
    expect(headers['X-Webhook-Secret']).toBe('my-secret');
  });

  it('returns job_id', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => ({ job_id: 'job-123' }) });
    const id = await dispatchTask('http://x/webhook', 's', { taskId: 'a', proposalId: 'b', metadata: {} });
    expect(id).toBe('job-123');
  });

  it('throws on non-2xx', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'unauthorized' });
    await expect(dispatchTask('http://x/webhook', 's', { taskId: 'a', proposalId: 'b', metadata: {} }))
      .rejects.toThrow('401');
  });
});

describe('pollJobStatus', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns immediately when status is completed', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: async () => ({ job_id: 'j1', status: 'completed', created_at: '' }),
    });
    const result = await pollJobStatus('http://x/webhook', 's', 'j1', 30_000);
    expect(result.status).toBe('completed');
  });

  it('throws after timeout', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: async () => ({ job_id: 'j1', status: 'running', created_at: '' }),
    });
    // timeout 0 means immediate timeout
    await expect(pollJobStatus('http://x/webhook', 's', 'j1', 0)).rejects.toThrow('timed out');
  });
});

describe('probeWebhook', () => {
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
});
