import * as forge from 'node-forge';
import type { DropletApiResponse } from './types';

const DO_API = 'https://api.digitalocean.com/v2';

export const DO_DEFAULTS = {
  size: 's-1vcpu-1gb',
  image: 'ubuntu-24-04-x64',
  region: 'nyc3',
};

const CLOUD_INIT_TEMPLATE = `#cloud-config
users:
  - name: ironclaw
    groups: sudo
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
    ssh_authorized_keys:
      - {{SSH_PUBLIC_KEY}}
package_update: true
package_upgrade: true
packages:
  - ufw
  - fail2ban
  - tmux
  - curl
runcmd:
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow 2222/tcp
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw allow 8080/tcp
  - ufw --force enable
  - sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config
  - sed -i 's/^Port 22$/Port 2222/' /etc/ssh/sshd_config
  - grep -q '^Port 2222' /etc/ssh/sshd_config || echo 'Port 2222' >> /etc/ssh/sshd_config
  - sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
  - systemctl restart sshd
  - systemctl enable fail2ban
  - systemctl start fail2ban
  - curl --proto '=https' --tlsv1.2 -LsSf https://github.com/nearai/ironclaw/releases/latest/download/ironclaw-installer.sh | sh -s -- --no-interactive 2>/dev/null || curl --proto '=https' --tlsv1.2 -LsSf https://github.com/nearai/ironclaw/releases/latest/download/ironclaw-installer.sh | sh
  - mkdir -p /home/ironclaw/.ironclaw/skills/delibera-worker
  - chown -R ironclaw:ironclaw /home/ironclaw/.ironclaw
`;

export function renderCloudInit(sshPublicKey: string): string {
  return CLOUD_INIT_TEMPLATE.replace('{{SSH_PUBLIC_KEY}}', sshPublicKey);
}

export function generateEphemeralSshKey(): { privateKey: string; publicKey: string } {
  const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
  const publicKeyOpenSsh = forge.ssh.publicKeyToOpenSSH(keypair.publicKey, 'ironclaw-deploy');
  return { privateKey: privateKeyPem, publicKey: publicKeyOpenSsh };
}

export async function createDroplet(
  apiToken: string,
  name: string,
  region: string,
  _sshPublicKey: string,
  userData: string,
): Promise<DropletApiResponse> {
  const res = await fetch(`${DO_API}/droplets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      region,
      size: DO_DEFAULTS.size,
      image: DO_DEFAULTS.image,
      user_data: userData,
      ssh_keys: [],
      ipv6: false,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DO createDroplet failed (${res.status}): ${err}`);
  }
  const data = await res.json() as { droplet: DropletApiResponse };
  return data.droplet;
}

export async function getDroplet(apiToken: string, dropletId: number): Promise<DropletApiResponse> {
  const res = await fetch(`${DO_API}/droplets/${dropletId}`, {
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error(`DO getDroplet failed (${res.status})`);
  const data = await res.json() as { droplet: DropletApiResponse };
  return data.droplet;
}

export async function waitForDropletIp(
  apiToken: string,
  dropletId: number,
  maxMinutes = 5,
): Promise<string> {
  const deadline = Date.now() + maxMinutes * 60 * 1000;
  while (Date.now() < deadline) {
    const droplet = await getDroplet(apiToken, dropletId);
    const pub = droplet.networks.v4.find(n => n.type === 'public');
    if (pub?.ip_address) return pub.ip_address;
    await new Promise(r => setTimeout(r, 10_000));
  }
  throw new Error(`Droplet ${dropletId} IP timeout after ${maxMinutes} minutes`);
}

export async function destroyDroplet(apiToken: string, dropletId: number): Promise<void> {
  try {
    await fetch(`${DO_API}/droplets/${dropletId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });
  } catch (err) {
    console.warn(`[ironclaw/do] destroyDroplet ${dropletId} failed (non-fatal):`, err);
  }
}
