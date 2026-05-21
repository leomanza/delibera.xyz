import * as net from 'net';
import {
  generateEphemeralSshKey,
  renderCloudInit,
  createDroplet,
  waitForDropletIp,
  destroyDroplet,
} from './ironclaw-provisioner';
import { configureIronClawWorker } from './ironclaw-ssh-configurator';
import { watchForIronClawWebhook } from './ironclaw-endpoint-watcher';
import type { IronClawWorkerConfig, DeployedIronClawWorker, IronClawDeployStep } from './types';

async function waitForSshPort(ip: string, port = 2222, maxMs = 180_000): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const s = net.createConnection({ host: ip, port });
      s.on('connect', () => { s.destroy(); resolve(true); });
      s.on('error', () => { s.destroy(); resolve(false); });
      setTimeout(() => { s.destroy(); resolve(false); }, 3000);
    });
    if (ok) return;
    await new Promise(r => setTimeout(r, 10_000));
  }
  throw new Error(`SSH port ${port} not reachable on ${ip} after ${maxMs / 1000}s`);
}

export async function deployIronClawWorker(
  config: IronClawWorkerConfig,
  onProgress: (step: IronClawDeployStep, detail?: string) => void,
): Promise<DeployedIronClawWorker> {
  let dropletId: number | undefined;

  try {
    onProgress('creating_droplet', 'Generating ephemeral SSH keypair...');
    const { privateKey: sshPrivKey, publicKey: sshPubKey } = generateEphemeralSshKey();
    const userData = renderCloudInit(sshPubKey);
    const suffix = Date.now().toString(36).slice(-4);
    const name = `delibera-ironclaw-${suffix}`;

    const droplet = await createDroplet(config.doApiToken, name, config.doRegion, sshPubKey, userData);
    dropletId = droplet.id;
    console.log(`[ironclaw] Droplet created: id=${dropletId}`);

    onProgress('waiting_for_ip', `Droplet id=${dropletId}, waiting for public IP...`);
    const dropletIp = await waitForDropletIp(config.doApiToken, dropletId, 5);
    console.log(`[ironclaw] Droplet IP: ${dropletIp}`);

    onProgress('waiting_for_ssh', `Waiting for SSH port 2222 on ${dropletIp}...`);
    await waitForSshPort(dropletIp);

    onProgress('configuring_agent', 'Running SSH configurator...');
    await configureIronClawWorker(dropletIp, sshPrivKey, config);

    onProgress('starting_agent', 'IronClaw started in tmux session');

    const webhookUrl = `http://${dropletIp}:${config.webhookPort}/webhook`;
    const cvmId = `ironclaw-${dropletId}`;

    // Background: wait for webhook to respond (non-blocking)
    watchForIronClawWebhook(webhookUrl, config.webhookSecret, () => {
      console.log(`[ironclaw] Webhook confirmed ready: ${webhookUrl}`);
    }).catch(console.error);

    onProgress('complete');

    return {
      dropletId,
      dropletIp,
      webhookUrl,
      webhookSecret: config.webhookSecret,
      cvmId,
      workerDid: config.workerDid,
    };
  } catch (err) {
    if (dropletId !== undefined) {
      console.warn(`[ironclaw] Deploy failed — destroying droplet ${dropletId}`);
      await destroyDroplet(config.doApiToken, dropletId);
    }
    throw err;
  }
}
