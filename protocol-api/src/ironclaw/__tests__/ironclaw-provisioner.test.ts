import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderCloudInit, generateEphemeralSshKey } from '../ironclaw-provisioner';

describe('renderCloudInit', () => {
  it('substitutes SSH_PUBLIC_KEY placeholder', () => {
    const result = renderCloudInit('ssh-rsa AAAA== test-key');
    expect(result).toContain('ssh-rsa AAAA== test-key');
    expect(result).not.toContain('{{SSH_PUBLIC_KEY}}');
  });

  it('contains port 2222 ufw rule', () => {
    expect(renderCloudInit('key')).toContain('ufw allow 2222/tcp');
  });

  it('contains port 8080 ufw rule', () => {
    expect(renderCloudInit('key')).toContain('ufw allow 8080/tcp');
  });

  it('contains ironclaw installer curl', () => {
    expect(renderCloudInit('key')).toContain('ironclaw-installer.sh');
  });
});

describe('generateEphemeralSshKey', () => {
  it('returns privateKey in PEM format', () => {
    const { privateKey } = generateEphemeralSshKey();
    expect(privateKey).toContain('BEGIN');
  });

  it('returns publicKey in OpenSSH authorized_keys format', () => {
    const { publicKey } = generateEphemeralSshKey();
    expect(publicKey).toMatch(/^ssh-rsa AAAA/);
  });

  it('generates unique keypairs each call', () => {
    const a = generateEphemeralSshKey();
    const b = generateEphemeralSshKey();
    expect(a.privateKey).not.toBe(b.privateKey);
  });
});

describe('createDroplet', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('POSTs to DO droplets endpoint with correct shape', async () => {
    const { createDroplet } = await import('../ironclaw-provisioner');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ droplet: { id: 123, status: 'new', networks: { v4: [] } } }),
    });
    const result = await createDroplet('token', 'test-worker', 'nyc3', 'ssh-rsa key', 'user-data');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.digitalocean.com/v2/droplets',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.name).toBe('test-worker');
    expect(body.region).toBe('nyc3');
    expect(body.user_data).toBe('user-data');
    expect(result.id).toBe(123);
  });

  it('throws on non-2xx response', async () => {
    const { createDroplet } = await import('../ironclaw-provisioner');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 422, text: async () => 'invalid region' });
    await expect(createDroplet('token', 'x', 'nyc3', 'key', 'data')).rejects.toThrow('422');
  });
});

describe('waitForDropletIp', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns IP when droplet has public network', async () => {
    const { waitForDropletIp } = await import('../ironclaw-provisioner');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        droplet: { id: 123, status: 'active', networks: { v4: [{ ip_address: '1.2.3.4', type: 'public' }] } },
      }),
    });
    const ip = await waitForDropletIp('token', 123, 1);
    expect(ip).toBe('1.2.3.4');
  });

  it('throws after timeout when no IP appears', async () => {
    const { waitForDropletIp } = await import('../ironclaw-provisioner');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ droplet: { id: 123, status: 'new', networks: { v4: [] } } }),
    });
    await expect(waitForDropletIp('token', 123, 0)).rejects.toThrow('timeout');
  });
});
