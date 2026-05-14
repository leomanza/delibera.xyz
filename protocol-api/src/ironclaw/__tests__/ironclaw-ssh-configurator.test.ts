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

/**
 * Tests for file uploads. Uploads are emitted as:
 *   printf '%s' '<base64>' | base64 -d > /path/to/file
 * This helper extracts and decodes the content so substring assertions still work.
 */
function decodeUpload(cmd: string): { content: string; destPath: string } | null {
  const m = cmd.match(/^printf '%s' '([A-Za-z0-9+/=]+)' \| base64 -d > (\S+)$/);
  if (!m) return null;
  return { content: Buffer.from(m[1], 'base64').toString('utf-8'), destPath: m[2] };
}

/** Find the uploaded file whose destination path ends with the given suffix. */
function findUpload(suffix: string): { content: string; destPath: string } | undefined {
  for (const call of mockExecCommand.mock.calls) {
    const decoded = decodeUpload(call[0] as string);
    if (decoded && decoded.destPath.endsWith(suffix)) return decoded;
  }
  return undefined;
}

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
    const envIdx = calls.findIndex(c => {
      const u = decodeUpload(c);
      return u !== null && u.destPath.endsWith('.env');
    });
    expect(cloudInitIdx).toBeGreaterThanOrEqual(0);
    expect(envIdx).toBeGreaterThanOrEqual(0);
    expect(cloudInitIdx).toBeLessThan(envIdx);
  });

  it('.env content uses NEARAI_API_KEY (IronClaw v0.28.1 contract), not NEAR_AI_API_KEY', async () => {
    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);
    const envFile = findUpload('/.env');
    expect(envFile).toBeDefined();
    expect(envFile!.content).toContain('NEARAI_API_KEY=ai-key');
    // The two-word variant must NOT appear — IronClaw silently ignores it.
    expect(envFile!.content).not.toMatch(/\bNEAR_AI_API_KEY=/);
    expect(envFile!.content).toContain('WORKER_DID=did:key:z6MkTest');
    expect(envFile!.content).toContain('HTTP_WEBHOOK_SECRET=webhook-secret');
    expect(envFile!.content).toContain('ENSUE_API_KEY=ensue-key');
    expect(envFile!.content).toContain('HTTP_PORT=8080');
  });

  it('IDENTITY.md has placeholders substituted', async () => {
    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);
    const identity = findUpload('IDENTITY.md');
    expect(identity).toBeDefined();
    expect(identity!.content).toContain('did:key:z6MkTest');
    expect(identity!.content).toContain('test.testnet');
    expect(identity!.content).not.toContain('{{WORKER_DID}}');
    expect(identity!.content).not.toContain('{{WORKER_NEAR_ACCOUNT}}');
  });

  it('USER.md has placeholders substituted (v0.28.1)', async () => {
    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);
    const user = findUpload('USER.md');
    expect(user).toBeDefined();
    expect(user!.content).toContain('coord-org');
    expect(user!.content).not.toContain('{{ENSUE_COORDINATOR_ORG}}');
    expect(user!.content).not.toContain('{{WORKER_DID}}');
  });

  it('uploads files safely when content contains heredoc-tag-like sequences (regression: tag injection)', async () => {
    // Override readFileSync for this test to return content containing every heredoc tag
    // historically used by the old `heredoc()` helper. With base64 uploads, these can never
    // truncate the file no matter what bytes the content contains.
    const fs = await import('fs');
    const original = vi.mocked(fs.readFileSync);
    original.mockImplementation((p: any) => {
      if (String(p).endsWith('AGENTS.md')) {
        return 'header\nIDEOF\nmiddle\nSHEOF\nfooter\nENVEOF\nMCPJS\nMCPPKG\nSKILLEOF\nUSEREOF';
      }
      return '# placeholder';
    });

    await configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig);

    const agents = findUpload('AGENTS.md');
    expect(agents).toBeDefined();
    // Content roundtrips intact — neither truncation nor injection happened.
    expect(agents!.content).toBe('header\nIDEOF\nmiddle\nSHEOF\nfooter\nENVEOF\nMCPJS\nMCPPKG\nSKILLEOF\nUSEREOF');
    // The actual command string must NOT contain a literal heredoc tag line in the shell-visible part.
    const agentsCmd = mockExecCommand.mock.calls
      .map(c => c[0] as string)
      .find(c => c.includes('AGENTS.md') && !c.includes('rm ') && !c.includes('mkdir'));
    expect(agentsCmd).toBeDefined();
    expect(agentsCmd!).not.toMatch(/\nIDEOF\n|\nSHEOF\n|\nENVEOF\n/);
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

  // execCommand returning non-zero must NOT be silently ignored. node-ssh's execCommand
  // resolves with {code} even on failure, so the configurator must wrap it and throw —
  // otherwise full-disk / network-down failures produce zombie droplets.
  it('throws when an execCommand returns non-zero exit code', async () => {
    // First exec call is `cloud-init status --wait` — make it fail.
    mockExecCommand.mockResolvedValueOnce({ stdout: '', stderr: 'cloud-init: error', code: 1 });
    await expect(
      configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig),
    ).rejects.toThrow(/code 1|cloud-init/i);
  });

  it('includes the command label and stderr snippet in the thrown error', async () => {
    mockExecCommand.mockResolvedValueOnce({ stdout: '', stderr: 'disk full', code: 28 });
    await expect(
      configureIronClawWorker('1.2.3.4', 'privkey-pem', baseConfig),
    ).rejects.toThrow(/disk full|code 28/);
  });
});
