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
      const p = String(filePath);
      if (p.includes('SKILL.md')) return '# Delibera Skill\ntest skill content';
      if (p.includes('AGENTS.md')) return '# Agent Rules\ntest agents';
      if (p.includes('SOUL.md')) return '# Soul\ntest soul';
      if (p.includes('IDENTITY.md')) return 'DID: {{WORKER_DID}}\nAccount: {{WORKER_NEAR_ACCOUNT}}\nContract: {{COORDINATOR_CONTRACT}}';
      if (p.includes('USER.md')) return 'Org: {{ENSUE_COORDINATOR_ORG}}\nWorker: {{WORKER_DID}}\nAccount: {{WORKER_NEAR_ACCOUNT}}';
      // MCP server bundle files (returned as opaque content — the test doesn't inspect them)
      if (p.includes('ensue-mcp-server') && (p.endsWith('index.js') || p.endsWith('package.json'))) return '// mock bundle';
      // Shared lib dist files
      if (p.includes('/shared/dist/')) return '// mock shared lib';
      return actual.readFileSync(filePath);
    }),
    existsSync: vi.fn((filePath: string) => {
      const p = String(filePath);
      // Pretend the MCP build exists; suppress shared dist files (so the loop just skips them)
      if (p.includes('ensue-mcp-server/dist/index.js')) return true;
      if (p.includes('/shared/dist/')) return false;
      return actual.existsSync(filePath);
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

// Replace setTimeout globally so the deploy sleeps resolve instantly under test.
// Restored only at module teardown — using afterEach with restoreAllMocks would
// also wipe the node-ssh mocks above.
const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
  fn();
  return 0 as unknown as NodeJS.Timeout;
}) as typeof setTimeout);

describe('configureIronClawWorker', () => {
  beforeEach(() => {
    mockExecCommand.mockClear();
    mockExecCommand.mockResolvedValue({ stdout: '', stderr: '', code: 0 });
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

  it('USER.md has placeholders substituted (v0.28.1)', async () => {
    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);
    const userCall = mockExecCommand.mock.calls.find(c => (c[0] as string).includes('USER.md'));
    expect(userCall![0]).toContain('coord-org');
    expect(userCall![0]).not.toContain('{{ENSUE_COORDINATOR_ORG}}');
    expect(userCall![0]).not.toContain('{{WORKER_DID}}');
  });

  it('starts IronClaw in a tmux session with --no-onboard flag', async () => {
    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);
    const calls = mockExecCommand.mock.calls.map(c => c[0] as string);
    const tmuxCall = calls.find(c => c.includes('tmux') && c.includes('ironclaw run'));
    expect(tmuxCall).toBeDefined();
    expect(tmuxCall!).toContain('--no-onboard');
  });

  it('disposes SSH connection even on error', async () => {
    mockConnect.mockRejectedValueOnce(new Error('connection refused'));
    await expect(configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig)).rejects.toThrow('connection refused');
    expect(mockDispose).toHaveBeenCalled();
  });

  it('deploys Ensue MCP server bundle to /opt/ensue-mcp-server', async () => {
    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);
    const calls = mockExecCommand.mock.calls.map(c => c[0] as string);
    expect(calls.some(c => c.includes('/opt/ensue-mcp-server') && c.includes('mkdir'))).toBe(true);
  });

  it('starts Ensue MCP server in its own tmux session with ENSUE_API_KEY', async () => {
    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);
    const calls = mockExecCommand.mock.calls.map(c => c[0] as string);
    const mcpStartCall = calls.find(c => c.includes('tmux') && c.includes('ensue-mcp'));
    expect(mcpStartCall).toBeDefined();
    expect(mcpStartCall!).toContain('ENSUE_API_KEY=');
    expect(mcpStartCall!).toContain('ensue-key'); // baseConfig.ensueApiKey
    expect(mcpStartCall!).toContain('PORT=7800');
  });

  it('registers Ensue MCP server with IronClaw via mcp add', async () => {
    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);
    const calls = mockExecCommand.mock.calls.map(c => c[0] as string);
    expect(calls.some(c => c.includes('ironclaw mcp add ensue'))).toBe(true);
  });
});
