import * as path from 'path';
import * as fs from 'fs';
import type { IronClawWorkerConfig } from './types';

// Skills live in coordinator-agent/src/skills/ relative to the repo root.
// From protocol-api/src/ironclaw/ → ../../../ = repo root
const SKILLS_DIR = path.resolve(__dirname, '../../../coordinator-agent/src/skills');

// Pre-built Ensue MCP server (single-file CommonJS bundle + node_modules)
// Expected layout: ensue-mcp-server/dist/index.js + ensue-mcp-server/node_modules/
const MCP_SERVER_DIR = path.resolve(__dirname, '../../../ensue-mcp-server');
const MCP_SERVER_REMOTE_DIR = '/opt/ensue-mcp-server';
const MCP_SERVER_PORT = 7800;

function buildEnvContent(config: IronClawWorkerConfig): string {
  return [
    `NEARAI_API_KEY=${config.nearAiApiKey}`,
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

/**
 * Upload arbitrary content to a remote path safely.
 *
 * Replaces the previous heredoc-based approach which could be truncated/injected
 * if the content contained the heredoc tag on its own line (CVE-class issue —
 * minified JS bundles and skill files can legitimately contain 5-char identifier
 * sequences). Base64 has no metacharacters and roundtrips bytes exactly.
 *
 * Works on both BSD (`/usr/bin/base64`) and GNU coreutils (`/usr/bin/base64`).
 * `printf '%s'` avoids the `echo` portability traps with backslash escapes.
 */
function uploadFile(content: string, destPath: string): string {
  const b64 = Buffer.from(content, 'utf-8').toString('base64');
  return `printf '%s' '${b64}' | base64 -d > ${destPath}`;
}

/**
 * Run an SSH command and THROW on non-zero exit. `node-ssh::execCommand` resolves
 * with `{stdout, stderr, code}` even when the remote command fails — silently
 * ignoring that lets disk-full, network-down, and permission-denied failures
 * produce zombie droplets. The `label` is included in the error message so Step 6
 * debugging can locate the failed step.
 */
async function execOrThrow(
  ssh: { execCommand: (cmd: string) => Promise<{ stdout: string; stderr: string; code: number | null }> },
  command: string,
  label: string,
): Promise<{ stdout: string; stderr: string }> {
  const result = await ssh.execCommand(command);
  // `code === null` means the process was killed by a signal — treat as success for our cleanup paths.
  if (result.code !== 0 && result.code !== null) {
    const errSnippet = (result.stderr || result.stdout || '').slice(0, 500).trim();
    throw new Error(`[ssh-configurator] ${label} exited with code ${result.code}${errSnippet ? `: ${errSnippet}` : ''}`);
  }
  return { stdout: result.stdout, stderr: result.stderr };
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
    await execOrThrow(ssh, 'cloud-init status --wait', 'cloud-init wait');

    // 2. Write IronClaw .env
    const envContent = buildEnvContent(config);
    await execOrThrow(ssh, uploadFile(envContent, '/home/ironclaw/.ironclaw/.env'), 'upload .env');

    // 3. Create skills directory
    await execOrThrow(ssh, 'mkdir -p /home/ironclaw/.ironclaw/skills/delibera-worker', 'mkdir skills');

    // 4. Render and upload SKILL.md (substitute ${VAR} placeholders — IronClaw does NOT do this).
    // Production workers always have a DIFFERENT Ensue org from the coordinator, so we use
    // the @<coordinator-org>/ cross-org prefix for the task definition read.
    // (Sandbox/same-org case is handled in sandbox/scripts/sync-skill.sh.)
    const taskDefinitionKey = `@${config.ensueCoordinatorOrg}/coordination/config/task_definition`;
    const skillMdRaw = fs.readFileSync(path.join(SKILLS_DIR, 'delibera-worker/SKILL.md'), 'utf-8');
    const skillMdRendered = skillMdRaw
      .replace(/\$\{WORKER_DID\}/g, config.workerDid)
      .replace(/\$\{WORKER_NEAR_ACCOUNT\}/g, config.workerNearAccount)
      .replace(/\$\{ENSUE_COORDINATOR_ORG\}/g, config.ensueCoordinatorOrg)
      .replace(/\$\{TASK_DEFINITION_KEY\}/g, taskDefinitionKey);
    await execOrThrow(ssh, uploadFile(skillMdRendered, '/home/ironclaw/.ironclaw/skills/delibera-worker/SKILL.md'), 'upload SKILL.md');

    // 5. Upload static identity files
    for (const fname of ['AGENTS.md', 'SOUL.md']) {
      const content = fs.readFileSync(path.join(SKILLS_DIR, 'delibera-worker-identity', fname), 'utf-8');
      await execOrThrow(ssh, uploadFile(content, `/home/ironclaw/.ironclaw/${fname}`), `upload ${fname}`);
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
    await execOrThrow(ssh, uploadFile(identityMd, '/home/ironclaw/.ironclaw/IDENTITY.md'), 'upload IDENTITY.md');

    // v0.28.1: identity file is USER.md (not HEARTBEAT.md as older docs suggested)
    const userMd = renderTemplate(
      path.join(SKILLS_DIR, 'delibera-worker-identity/USER.md'),
      {
        ENSUE_COORDINATOR_ORG: config.ensueCoordinatorOrg,
        WORKER_DID: config.workerDid,
        WORKER_NEAR_ACCOUNT: config.workerNearAccount,
      },
    );
    await execOrThrow(ssh, uploadFile(userMd, '/home/ironclaw/.ironclaw/USER.md'), 'upload USER.md');

    // 7. Deploy the Ensue MCP server
    await deployEnsueMcpServer(ssh, config);

    // 8. Start IronClaw in tmux (detached, headless).
    // tmux returns non-zero if the session already exists — we tolerate that with `|| true`
    // because re-running the configurator on an existing droplet shouldn't error.
    await execOrThrow(
      ssh,
      'tmux new-session -d -s ironclaw "ironclaw run --no-onboard" 2>/dev/null || true',
      'start ironclaw in tmux',
    );

    // 9. Register the Ensue MCP server with IronClaw.
    // Done after IronClaw is up so the registration is durable in the DB.
    // Wait briefly for IronClaw to be ready before registering.
    // The `|| true` tolerates the case where the MCP server was already registered.
    await new Promise((r) => setTimeout(r, 5_000));
    await execOrThrow(
      ssh,
      `ironclaw mcp add ensue http://127.0.0.1:${MCP_SERVER_PORT}/mcp 2>/dev/null || true`,
      'register MCP with IronClaw',
    );
  } finally {
    ssh.dispose();
  }
}

/**
 * Bundle the pre-built Ensue MCP server, upload it to the droplet, install
 * runtime deps if needed, and start it in a dedicated tmux session.
 *
 * Prerequisites on the droplet (handled by cloud-init):
 *   - Node.js 20+ installed
 *   - tmux installed
 *
 * Layout on remote:
 *   /opt/ensue-mcp-server/dist/index.js
 *   /opt/ensue-mcp-server/node_modules/...
 *   /opt/ensue-mcp-server/package.json
 */
async function deployEnsueMcpServer(
  ssh: { execCommand: (cmd: string) => Promise<{ stdout: string; stderr: string; code: number | null }>; putDirectory?: unknown },
  config: IronClawWorkerConfig,
): Promise<void> {
  // Verify the local build exists. If not, the deploy is misconfigured —
  // we won't try to build on the droplet (no npm there, smaller blast radius).
  const distPath = path.join(MCP_SERVER_DIR, 'dist/index.js');
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Ensue MCP server build not found at ${distPath}. Run 'npm run build' in ensue-mcp-server/ before deploying.`,
    );
  }

  // 1. Make remote dir
  await execOrThrow(
    ssh,
    `sudo mkdir -p ${MCP_SERVER_REMOTE_DIR} && sudo chown ironclaw:ironclaw ${MCP_SERVER_REMOTE_DIR}`,
    'mkdir MCP remote dir',
  );

  // 2. Upload the dist + package.json. node_modules is not vendored — we
  //    install on the droplet (small dep tree, just MCP SDK + zod + shared lib).
  const indexJs = fs.readFileSync(distPath, 'utf-8');
  await execOrThrow(ssh, uploadFile(indexJs, `${MCP_SERVER_REMOTE_DIR}/index.js`), 'upload MCP index.js');

  const packageJson = fs.readFileSync(path.join(MCP_SERVER_DIR, 'package.json'), 'utf-8');
  await execOrThrow(ssh, uploadFile(packageJson, `${MCP_SERVER_REMOTE_DIR}/package.json`), 'upload MCP package.json');

  // 3. Install runtime deps on the droplet
  // The 'shared' workspace dep can't be installed via npm (file:../shared) —
  // we bundle its built output too. Easier: vendor the shared dist into the
  // MCP server's expected location.
  const sharedDist = path.resolve(MCP_SERVER_DIR, '../shared');
  if (fs.existsSync(path.join(sharedDist, 'dist/ensue-client.js'))) {
    // Upload shared lib to /opt/shared
    await execOrThrow(ssh, 'sudo mkdir -p /opt/shared && sudo chown ironclaw:ironclaw /opt/shared', 'mkdir /opt/shared');
    for (const f of ['dist/ensue-client.js', 'dist/index.js', 'dist/types.js', 'dist/constants.js', 'dist/utils.js', 'dist/name-resolver.js', 'dist/did-utils.js']) {
      const src = path.join(sharedDist, f);
      if (fs.existsSync(src)) {
        const content = fs.readFileSync(src, 'utf-8');
        const remotePath = `/opt/shared/${f.replace('dist/', '')}`;
        await execOrThrow(ssh, `sudo mkdir -p $(dirname ${remotePath})`, `mkdir parent of ${remotePath}`);
        await execOrThrow(ssh, uploadFile(content, remotePath), `upload ${f}`);
      }
    }
  }

  // 4. Install npm deps (MCP SDK + zod) — we install the prod deps only
  await execOrThrow(
    ssh,
    `cd ${MCP_SERVER_REMOTE_DIR} && npm install --omit=dev --omit=optional @modelcontextprotocol/sdk zod 2>&1 | tail -5`,
    'npm install MCP deps',
  );

  // 5. Start the MCP server in tmux with the worker's Ensue API key.
  // Pass ENSUE_API_KEY via env (not echoed). HOST=127.0.0.1 so it only listens on loopback.
  // `|| true` tolerates re-running the configurator when the session already exists.
  const startCmd = `ENSUE_API_KEY='${config.ensueApiKey}' PORT=${MCP_SERVER_PORT} HOST=127.0.0.1 node ${MCP_SERVER_REMOTE_DIR}/index.js`;
  await execOrThrow(
    ssh,
    `tmux new-session -d -s ensue-mcp "${startCmd}" 2>/dev/null || true`,
    'start MCP server in tmux',
  );

  // 6. Wait briefly + sanity-check it's listening
  await new Promise((r) => setTimeout(r, 3_000));
  // Use raw execCommand here — the probe inspects the return shape and reports
  // a warning rather than failing the whole deploy.
  const probe = await ssh.execCommand(`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${MCP_SERVER_PORT}/mcp -X POST -H 'Content-Type: application/json' -d '{}'`);
  // Any HTTP code (even 400) means the server is up; only ECONNREFUSED would fail.
  if (probe.code !== 0) {
    console.warn(`[ironclaw] Ensue MCP server probe returned code ${probe.code} — continuing anyway`);
  }
}
