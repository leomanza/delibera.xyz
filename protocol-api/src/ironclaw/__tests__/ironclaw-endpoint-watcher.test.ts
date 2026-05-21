import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../ironclaw-client', () => ({
  probeWebhook: vi.fn(),
}));

import { watchForIronClawWebhook } from '../ironclaw-endpoint-watcher';
import { probeWebhook } from '../ironclaw-client';

afterEach(() => { vi.clearAllMocks(); });

describe('watchForIronClawWebhook', () => {
  it('calls onReady when probe succeeds immediately', async () => {
    (probeWebhook as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const onReady = vi.fn();
    await watchForIronClawWebhook('http://x/webhook', 's', onReady, 1);
    expect(onReady).toHaveBeenCalledWith('http://x/webhook');
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('does not call onReady when probe always fails', async () => {
    (probeWebhook as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const onReady = vi.fn();
    // maxMinutes=0 → 0 attempts → exits immediately without calling onReady
    await watchForIronClawWebhook('http://x/webhook', 's', onReady, 0);
    expect(onReady).not.toHaveBeenCalled();
  });

  it('does not throw when timeout exceeded', async () => {
    (probeWebhook as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await expect(watchForIronClawWebhook('http://x/webhook', 's', vi.fn(), 0)).resolves.toBeUndefined();
  });
});
