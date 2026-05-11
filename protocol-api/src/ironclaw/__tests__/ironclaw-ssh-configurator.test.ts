import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node-ssh before importing the configurator
const mockExecCommand = vi.fn().mockResolvedValue({ stdout: '', stderr: '', code: 0 });
const mockDispose = vi.fn();
const mockConnect = vi.fn().mockResolvedValue(undefined);

vi.mock('node-ssh', () => ({
  NodeSSH: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    execCommand: mockExecCommand,
    dispose: mockDispose,
  })),
}));

// Mock fs to avoid needing real skill files on disk during tests
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readFileSync: vi.fn((filePath: string) => {
      if (String(filePath).includes('SKILL.md')) return '# Delibera Skill\ntest skill content';
      if (String(filePath).includes('AGENTS.md')) return '# Agent Rules\ntest agents';
      if (String(filePath).includes('SOUL.md')) return '# Soul\ntest soul';
      if (String(filePath).includes('IDENTITY.md')) return 'DID: {{WORKER_DID}}\nAccount: {{WORKER_NEAR_ACCOUNT}}\nContract: {{COORDINATOR_CONTRACT}}';
      if (String(filePath).includes('HEARTBEAT.md')) return 'Org: {{ENSUE_COORDINATOR_ORG}}\nWorker: {{WORKER_DID}}';
      return actual.readFileSync(filePath);
    }),
  };
});

import { configureIronClawWorker } from '../ironclaw-ssh-configurator';
import type { IronClawWorkerConfig } from '../types';

const baseConfig: IronClawWorkerConfig = {
  doApiToken: 'tok', doRegion: 'nyc3', doSize: 's-1vcpu-1gb',
  workerDid: 'did:key:z6MkTest',
  workerNearAccount: 'test.testnet',
  storachaPrivateKey: 'privkey',
  storachaDelegation: 'delegation',
  storachaSpaceDid: 'did:key:space',
  coordinatorDid: 'did:key:coord',
  ensueApiKey: 'ensue-key',
  ensueCoordinatorOrg: 'coord-org',
  nearAiApiKey: 'ai-key',
  webhookSecret: 'webhook-secret',
  webhookPort: 8080,
  coordinatorContract: 'coordinator.testnet',
};

describe('configureIronClawWorker', () => {
  beforeEach(() => {
    mockExecCommand.mockClear();
    mockDispose.mockClear();
    mockConnect.mockClear();
    mockConnect.mockResolvedValue(undefined);
  });

  it('connects on port 2222 as ironclaw user', async () => {
    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);
    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({ port: 2222, username: 'ironclaw', host: '1.2.3.4' }),
    );
  });

  it('waits for cloud-init before writing env', async () => {
    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);
    const calls = mockExecCommand.mock.calls.map(c => c[0] as string);
    const cloudInitIdx = calls.findIndex(c => c.includes('cloud-init status'));
    const envIdx = calls.findIndex(c => c.includes('NEAR_AI_API_KEY'));
    expect(cloudInitIdx).toBeGreaterThanOrEqual(0);
    expect(cloudInitIdx).toBeLessThan(envIdx);
  });

  it('.env content includes all required vars', async () => {
    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);
    const envCall = mockExecCommand.mock.calls.find(c => (c[0] as string).includes('NEAR_AI_API_KEY'));
    expect(envCall![0]).toContain('WORKER_DID=did:key:z6MkTest');
    expect(envCall![0]).toContain('HTTP_WEBHOOK_SECRET=webhook-secret');
    expect(envCall![0]).toContain('ENSUE_API_KEY=ensue-key');
    expect(envCall![0]).toContain('HTTP_PORT=8080');
  });

  it('IDENTITY.md has placeholders substituted', async () => {
    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);
    const identityCall = mockExecCommand.mock.calls.find(c => (c[0] as string).includes('IDENTITY.md'));
    expect(identityCall![0]).toContain('did:key:z6MkTest');
    expect(identityCall![0]).toContain('test.testnet');
    expect(identityCall![0]).not.toContain('{{WORKER_DID}}');
    expect(identityCall![0]).not.toContain('{{WORKER_NEAR_ACCOUNT}}');
  });

  it('HEARTBEAT.md has placeholders substituted', async () => {
    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);
    const hbCall = mockExecCommand.mock.calls.find(c => (c[0] as string).includes('HEARTBEAT.md'));
    expect(hbCall![0]).toContain('coord-org');
    expect(hbCall![0]).not.toContain('{{ENSUE_COORDINATOR_ORG}}');
  });

  it('starts IronClaw in a tmux session', async () => {
    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);
    const calls = mockExecCommand.mock.calls.map(c => c[0] as string);
    expect(calls.some(c => c.includes('tmux') && c.includes('ironclaw run'))).toBe(true);
  });

  it('disposes SSH connection even on error', async () => {
    mockConnect.mockRejectedValueOnce(new Error('connection refused'));
    await expect(configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig)).rejects.toThrow('connection refused');
    expect(mockDispose).toHaveBeenCalled();
  });
});
