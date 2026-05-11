import * as path from 'path';
import * as fs from 'fs';
import type { IronClawWorkerConfig } from './types';

// Skills live in coordinator-agent/src/skills/ relative to the repo root.
// From protocol-api/src/ironclaw/ → ../../../ = repo root
const SKILLS_DIR = path.resolve(__dirname, '../../../coordinator-agent/src/skills');

function buildEnvContent(config: IronClawWorkerConfig): string {
  return [
    `NEAR_AI_API_KEY=${config.nearAiApiKey}`,
    `HTTP_ENABLED=true`,
    `HTTP_HOST=0.0.0.0`,
    `HTTP_PORT=${config.webhookPort}`,
    `HTTP_WEBHOOK_SECRET=${config.webhookSecret}`,
    `HEARTBEAT_ENABLED=true`,
    `HEARTBEAT_INTERVAL_SECS=60`,
    `SELF_REPAIR_ENABLED=true`,
    `SELF_REPAIR_MAX_RETRIES=3`,
    `WORKER_DID=${config.workerDid}`,
    `WORKER_NEAR_ACCOUNT=${config.workerNearAccount}`,
    `ENSUE_API_KEY=${config.ensueApiKey}`,
    `ENSUE_COORDINATOR_ORG=${config.ensueCoordinatorOrg}`,
    `STORACHA_AGENT_PRIVATE_KEY=${config.storachaPrivateKey}`,
    `STORACHA_DELEGATION_PROOF=${config.storachaDelegation}`,
    `STORACHA_SPACE_DID=${config.storachaSpaceDid}`,
    `COORDINATOR_DID=${config.coordinatorDid}`,
    `COORDINATOR_CONTRACT=${config.coordinatorContract}`,
  ].join('\n');
}

function renderTemplate(templatePath: string, vars: Record<string, string>): string {
  let content = fs.readFileSync(templatePath, 'utf-8');
  for (const [k, v] of Object.entries(vars)) {
    content = content.split(`{{${k}}}`).join(v);
  }
  return content;
}

function heredoc(tag: string, content: string, destPath: string): string {
  return `cat > ${destPath} << '${tag}'\n${content}\n${tag}`;
}

export async function configureIronClawWorker(
  dropletIp: string,
  sshPrivateKey: string,
  config: IronClawWorkerConfig,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NodeSSH } = await import('node-ssh');
  const ssh = new NodeSSH();

  try {
    await ssh.connect({
      host: dropletIp,
      port: 2222,
      username: 'ironclaw',
      privateKey: sshPrivateKey,
      readyTimeout: 30_000,
    });

    // 1. Wait for cloud-init to complete first boot
    await ssh.execCommand('cloud-init status --wait');

    // 2. Write IronClaw .env
    const envContent = buildEnvContent(config);
    await ssh.execCommand(heredoc('ENVEOF', envContent, '/home/ironclaw/.ironclaw/.env'));

    // 3. Create skills directory
    await ssh.execCommand('mkdir -p /home/ironclaw/.ironclaw/skills/delibera-worker');

    // 4. Upload SKILL.md
    const skillMd = fs.readFileSync(path.join(SKILLS_DIR, 'delibera-worker/SKILL.md'), 'utf-8');
    await ssh.execCommand(heredoc('SKILLEOF', skillMd, '/home/ironclaw/.ironclaw/skills/delibera-worker/SKILL.md'));

    // 5. Upload static identity files
    for (const fname of ['AGENTS.md', 'SOUL.md']) {
      const content = fs.readFileSync(path.join(SKILLS_DIR, 'delibera-worker-identity', fname), 'utf-8');
      await ssh.execCommand(heredoc('IDEOF', content, `/home/ironclaw/.ironclaw/${fname}`));
    }

    // 6. Render and upload template identity files
    const identityMd = renderTemplate(
      path.join(SKILLS_DIR, 'delibera-worker-identity/IDENTITY.md'),
      {
        WORKER_DID: config.workerDid,
        WORKER_NEAR_ACCOUNT: config.workerNearAccount,
        COORDINATOR_CONTRACT: config.coordinatorContract,
      },
    );
    await ssh.execCommand(heredoc('IDEOF', identityMd, '/home/ironclaw/.ironclaw/IDENTITY.md'));

    const heartbeatMd = renderTemplate(
      path.join(SKILLS_DIR, 'delibera-worker-identity/HEARTBEAT.md'),
      {
        ENSUE_COORDINATOR_ORG: config.ensueCoordinatorOrg,
        WORKER_DID: config.workerDid,
      },
    );
    await ssh.execCommand(heredoc('HBEOF', heartbeatMd, '/home/ironclaw/.ironclaw/HEARTBEAT.md'));

    // 7. Start IronClaw in tmux (detached, headless)
    await ssh.execCommand('tmux new-session -d -s ironclaw "ironclaw run" 2>/dev/null || true');
  } finally {
    ssh.dispose();
  }
}
