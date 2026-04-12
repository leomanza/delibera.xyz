/**
 * One-shot setup for the /x402-demo Pattern-C buyer wallet.
 *
 * Generates a fresh Stellar testnet keypair, funds it via Friendbot, creates
 * a USDC trustline, appends the secret to frontend/.env.local, and prints the
 * Circle faucet URL so you can drop testnet USDC into it.
 *
 * Usage:
 *   pnpm --filter frontend setup-demo-wallet
 *   # or
 *   cd frontend && npx tsx scripts/setup-demo-wallet.ts
 *
 * After this completes, visit https://faucet.circle.com/ → select Stellar
 * testnet → paste the printed public key. 10 USDC = ~830 demo runs at
 * $0.012/run (deliberate $0.01 + max one verdict poll $0.002).
 *
 * Re-running the script is a no-op if STELLAR_DEMO_BUYER_KEY is already in
 * .env.local. Delete that line first if you want to rotate the wallet.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as StellarSdk from '@stellar/stellar-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve frontend/.env.local relative to this script (frontend/scripts/).
const ENV_LOCAL_PATH = path.resolve(__dirname, '..', '.env.local');

// Testnet USDC asset (same one the x402 facilitator settles in).
const USDC_ISSUER_TESTNET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC_ASSET = new StellarSdk.Asset('USDC', USDC_ISSUER_TESTNET);

const FRIENDBOT_URL = 'https://friendbot.stellar.org';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';

/* ─── Tiny ANSI helpers ────────────────────────────────────────────────── */
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};
const color = (k: keyof typeof c, s: string) => `${c[k]}${s}${c.reset}`;

/* ─── Pre-flight: refuse to overwrite an existing key ──────────────────── */
function assertNoExistingKey(): void {
  if (!fs.existsSync(ENV_LOCAL_PATH)) return;
  const existing = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
  // Match a non-commented STELLAR_DEMO_BUYER_KEY= line.
  const re = /^[^#\n]*STELLAR_DEMO_BUYER_KEY\s*=/m;
  if (re.test(existing)) {
    console.error(color('red', '✗ STELLAR_DEMO_BUYER_KEY is already set in frontend/.env.local'));
    console.error(
      color('dim', '  Delete (or comment out) that line first if you want to rotate the demo wallet.'),
    );
    console.error(color('dim', `  Path: ${ENV_LOCAL_PATH}`));
    process.exit(1);
  }
}

/* ─── Step 1: generate fresh keypair ───────────────────────────────────── */
function generateKeypair(): StellarSdk.Keypair {
  const kp = StellarSdk.Keypair.random();
  console.log(color('cyan', '\n[1/4] Generating fresh testnet keypair...'));
  console.log(color('dim', `      Public: ${kp.publicKey()}`));
  console.log(color('dim', `      Secret: ${kp.secret().slice(0, 8)}…(hidden)`));
  return kp;
}

/* ─── Step 2: friendbot fund ───────────────────────────────────────────── */
async function fundViaFriendbot(publicKey: string): Promise<void> {
  console.log(color('cyan', '\n[2/4] Funding via Friendbot (free testnet XLM)...'));
  const url = `${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Friendbot returned ${res.status}: ${body.slice(0, 200)}`);
  }
  console.log(color('green', '      ✓ Funded with 10,000 testnet XLM'));
}

/* ─── Step 3: establish USDC trustline ─────────────────────────────────── */
async function establishUsdcTrustline(keypair: StellarSdk.Keypair): Promise<void> {
  console.log(color('cyan', '\n[3/4] Establishing USDC trustline...'));
  const horizon = new StellarSdk.Horizon.Server(HORIZON_URL);
  const account = await horizon.loadAccount(keypair.publicKey());

  // Idempotent — Friendbot funding doesn't include any trustlines, so we
  // expect the trustline NOT to exist on a freshly funded account, but check
  // anyway in case Friendbot's behavior changes.
  const existing = account.balances.find(
    (b) =>
      'asset_code' in b &&
      b.asset_code === 'USDC' &&
      'asset_issuer' in b &&
      b.asset_issuer === USDC_ISSUER_TESTNET,
  );
  if (existing) {
    console.log(color('yellow', '      ⊙ USDC trustline already present, skipping'));
    return;
  }

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(StellarSdk.Operation.changeTrust({ asset: USDC_ASSET }))
    .setTimeout(30)
    .build();
  tx.sign(keypair);

  const result = await horizon.submitTransaction(tx);
  console.log(color('green', `      ✓ Trustline created (tx: ${result.hash.slice(0, 16)}…)`));
}

/* ─── Step 4: persist secret to .env.local ─────────────────────────────── */
function persistSecret(secret: string): void {
  console.log(color('cyan', '\n[4/4] Saving secret to frontend/.env.local...'));
  // Append, don't overwrite — we already asserted no existing key above.
  const line = `\n# Demo buyer wallet for /x402-demo (Pattern-C server-side x402 client)\nSTELLAR_DEMO_BUYER_KEY=${secret}\n`;
  fs.appendFileSync(ENV_LOCAL_PATH, line);
  console.log(color('green', `      ✓ Wrote STELLAR_DEMO_BUYER_KEY to ${ENV_LOCAL_PATH}`));
}

/* ─── Main ─────────────────────────────────────────────────────────────── */
async function main(): Promise<void> {
  console.log(color('bold', '\n╔══════════════════════════════════════════════════════════════╗'));
  console.log(color('bold', '║  Delibera /x402-demo — buyer wallet setup                    ║'));
  console.log(color('bold', '╚══════════════════════════════════════════════════════════════╝'));

  assertNoExistingKey();

  const keypair = generateKeypair();
  await fundViaFriendbot(keypair.publicKey());
  await establishUsdcTrustline(keypair);
  persistSecret(keypair.secret());

  console.log('');
  console.log(color('bold', '═══════════════════════════ NEXT STEP ═══════════════════════════'));
  console.log('');
  console.log(color('yellow', '  Drop testnet USDC into the wallet via Circle faucet:'));
  console.log('');
  console.log(color('cyan', `    https://faucet.circle.com/`));
  console.log('');
  console.log(color('dim', '    1. Select "Stellar Testnet" in the network dropdown'));
  console.log(color('dim', `    2. Paste this address: ${keypair.publicKey()}`));
  console.log(color('dim', '    3. Click "Request 10 USDC" — instant'));
  console.log('');
  console.log(color('dim', '  10 USDC = ~830 demo runs at $0.012/run.'));
  console.log(color('dim', '  Re-hit the faucet anytime if the demo wallet runs dry.'));
  console.log('');
  console.log(color('green', '✓ Demo wallet ready. Start the frontend and visit /x402-demo.'));
  console.log('');
}

main().catch((err) => {
  console.error(color('red', '\nFATAL:'), err);
  process.exit(1);
});
