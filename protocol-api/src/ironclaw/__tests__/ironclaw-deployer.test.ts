import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ironclaw-provisioner', () => ({
  generateEphemeralSshKey: vi.fn().mockReturnValue({ privateKey: 'priv-pem', publicKey: 'ssh-rsa AAAA== key' }),
  renderCloudInit: vi.fn().mockReturnValue('#cloud-config\n'),
  createDroplet: vi.fn().mockResolvedValue({ id: 999, status: 'new', networks: { v4: [] } }),
  waitForDropletIp: vi.fn().mockResolvedValue('10.0.0.1'),
  destroyDroplet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../ironclaw-ssh-configurator', () => ({
  configureIronClawWorker: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../ironclaw-endpoint-watcher', () => ({
  watchForIronClawWebhook: vi.fn().mockResolvedValue(undefined),
}));

// Mock net to avoid TCP connections in tests
vi.mock('net', () => ({
  createConnection: vi.fn().mockImplementation((_opts: unknown, cb?: () => void) => {
    if (cb) setTimeout(cb, 0);
    const socket = { on: vi.fn().mockReturnThis(), destroy: vi.fn() };
    // Simulate immediate connection success
    setTimeout(() => {
      const connectHandler = (socket.on as ReturnType<typeof vi.fn>).mock.calls.find((c: string[]) => c[0] === 'connect')?.[1];
      if (connectHandler) connectHandler();
    }, 0);
    return socket;
  }),
}));

import { deployIronClawWorker } from '../ironclaw-deployer';
import { createDroplet, destroyDroplet } from '../ironclaw-provisioner';
import { configureIronClawWorker } from '../ironclaw-ssh-configurator';
import type { IronClawWorkerConfig } from '../types';

const cfg: IronClawWorkerConfig = {
  doApiToken: 'tok', doRegion: 'nyc3', doSize: 's-1vcpu-1gb',
  workerDid: 'did:key:z6Mk', workerNearAccount: 'w.testnet',
  storachaPrivateKey: 'pk', storachaDelegation: 'del', storachaSpaceDid: 'did:sp',
  coordinatorDid: 'did:coord', ensueApiKey: 'ek', ensueCoordinatorOrg: 'org',
  nearAiApiKey: 'ai', webhookSecret: 'ws', webhookPort: 8080,
  coordinatorContract: 'coord.testnet',
};

describe('deployIronClawWorker', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns correct DeployedIronClawWorker shape', async () => {
    const result = await deployIronClawWorker(cfg, vi.fn());
    expect(result.dropletId).toBe(999);
    expect(result.dropletIp).toBe('10.0.0.1');
    expect(result.webhookUrl).toBe('http://10.0.0.1:8080/webhook');
    expect(result.cvmId).toBe('ironclaw-999');
    expect(result.workerDid).toBe('did:key:z6Mk');
  });

  it('calls destroyDroplet on SSH configurator failure', async () => {
    (configureIronClawWorker as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ssh fail'));
    await expect(deployIronClawWorker(cfg, vi.fn())).rejects.toThrow('ssh fail');
    expect(destroyDroplet).toHaveBeenCalledWith('tok', 999);
  });

  it('emits creating_droplet and configuring_agent progress events', async () => {
    const steps: string[] = [];
    await deployIronClawWorker(cfg, (step) => steps.push(step));
    expect(steps).toContain('creating_droplet');
    expect(steps).toContain('configuring_agent');
    expect(steps).toContain('complete');
  });

  it('does not call destroyDroplet on success', async () => {
    await deployIronClawWorker(cfg, vi.fn());
    expect(destroyDroplet).not.toHaveBeenCalled();
  });

  it('cloud-init renders with SSH public key', async () => {
    const { renderCloudInit } = await import('../ironclaw-provisioner');
    await deployIronClawWorker(cfg, vi.fn());
    expect(renderCloudInit).toHaveBeenCalledWith('ssh-rsa AAAA== key');
  });
});
