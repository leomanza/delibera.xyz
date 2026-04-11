/**
 * Delibera x402 autonomous client demo.
 *
 * This script plays the role of an external AI agent that wants to outsource
 * a governance decision to the Delibera deliberation oracle:
 *
 *   1. Fetches /x402/info (free) to discover pricing and capabilities.
 *   2. Pays $0.01 USDC on Stellar via x402 to POST /x402/deliberate with a
 *      real-world DAO proposal. The x402 middleware handles 402 negotiation,
 *      auth-entry signing, and facilitator settlement under the hood.
 *   3. Polls GET /x402/verdict/:id (each poll costs $0.002 USDC) until the
 *      multi-agent NEAR deliberation resolves or we hit the poll cap.
 *   4. Prints the final verdict, per-worker votes, and cross-chain audit
 *      trail (Stellar payment tx + NEAR proposal id).
 *
 * Run:
 *   cp .env.example .env   # fill in STELLAR_PRIVATE_KEY
 *   npm install
 *   npm run demo
 *
 * Requirements:
 *   - The secret key must control a Stellar testnet account with a USDC
 *     trustline and a USDC balance. OZ Channels sponsors XLM fees, so the
 *     account does NOT need XLM beyond the base reserve for the trustline.
 *   - The Delibera coordinator must be running at DELIBERA_SERVER_URL with
 *     STELLAR_SERVER_ADDRESS configured in its own .env.
 */

import { config as loadEnv } from 'dotenv';
import { createEd25519Signer } from '@x402/stellar';
import { ExactStellarScheme } from '@x402/stellar/exact/client';
import { x402Client, wrapFetchWithPayment } from '@x402/fetch';

loadEnv();

/* ─── Config ───────────────────────────────────────────────────────────── */

const STELLAR_PRIVATE_KEY = process.env.STELLAR_PRIVATE_KEY ?? '';
const DELIBERA_SERVER_URL =
  process.env.DELIBERA_SERVER_URL?.replace(/\/+$/, '') ?? 'http://localhost:3000';
const DEFAULT_PROPOSAL =
  process.env.DELIBERA_PROPOSAL ??
  'Should the DAO allocate 50,000 USDC from the treasury to fund a six-month developer education program, given the treasury currently holds 2M USDC and burns ~100K/month?';
const DEFAULT_CONTEXT = {
  dao: 'demo-dao.testnet',
  treasury_balance_usdc: 2_000_000,
  monthly_burn_usdc: 100_000,
  proposal_amount_usdc: 50_000,
  rationale:
    'The program would onboard ~200 new contributors over six months. Historical return on similar programs has ranged from -20% to +150% in measurable retained contributors. Three worker agents with different governance perspectives should deliberate.',
};
const MAX_POLLS = Number(process.env.DELIBERA_MAX_POLLS ?? 6);
const POLL_DELAY_MS = 10_000;
const STELLAR_NETWORK = 'stellar:testnet' as const;

/* ─── Tiny ANSI color helpers (no deps) ────────────────────────────────── */

const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};
const c = (color: keyof typeof ansi, text: string): string =>
  `${ansi[color]}${text}${ansi.reset}`;

function banner(): void {
  console.log('');
  console.log(c('bold', '╔══════════════════════════════════════════════════════════════╗'));
  console.log(c('bold', '║  Delibera x402 — Autonomous Governance Agent Demo            ║'));
  console.log(c('bold', '║  Stellar USDC ──▶ Multi-agent NEAR deliberation              ║'));
  console.log(c('bold', '╚══════════════════════════════════════════════════════════════╝'));
  console.log('');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* ─── Main demo flow ───────────────────────────────────────────────────── */

async function main(): Promise<void> {
  banner();

  if (!STELLAR_PRIVATE_KEY) {
    console.error(
      c('red', 'ERROR: STELLAR_PRIVATE_KEY is not set. Copy .env.example to .env and add a funded testnet secret key.'),
    );
    process.exit(1);
  }
  if (!STELLAR_PRIVATE_KEY.startsWith('S') || STELLAR_PRIVATE_KEY.length !== 56) {
    console.error(
      c('red', `ERROR: STELLAR_PRIVATE_KEY must be a 56-char Stellar secret key starting with "S" (got ${STELLAR_PRIVATE_KEY.length} chars).`),
    );
    process.exit(1);
  }

  console.log(c('dim', `Delibera server: ${DELIBERA_SERVER_URL}`));
  console.log(c('dim', `Stellar network: ${STELLAR_NETWORK}`));

  // ── Build x402 fetch wrapper ─────────────────────────────────────────
  console.log(c('blue', '\n[1/4] Initializing Stellar signer + x402 client...'));
  const signer = createEd25519Signer(STELLAR_PRIVATE_KEY, STELLAR_NETWORK);
  console.log(c('dim', `      Buyer public key: ${signer.address}`));

  const scheme = new ExactStellarScheme(signer);
  const client = new x402Client().register(STELLAR_NETWORK, scheme);
  const fetchWithPay = wrapFetchWithPayment(fetch, client);

  // ── Step 1: free service discovery ───────────────────────────────────
  console.log(c('blue', '\n[2/4] Fetching service info (free)...'));
  const infoRes = await fetch(`${DELIBERA_SERVER_URL}/x402/info`);
  if (!infoRes.ok) {
    console.error(c('red', `ERROR: /x402/info returned ${infoRes.status}. Is the coordinator running?`));
    process.exit(1);
  }
  const info = (await infoRes.json()) as {
    service: { name: string; description: string; version: string };
    payment: { network: string; payTo: string; asset: string };
    endpoints: Array<{ method: string; path: string; price: string; description: string }>;
    stats: { totalDeliberations: number; completed: number; pending: number; failed: number };
  };
  console.log(c('green', `      ✓ ${info.service.name} v${info.service.version}`));
  console.log(c('dim', `      ${info.service.description}`));
  console.log(c('dim', `      Paying to: ${info.payment.payTo} on ${info.payment.network}`));
  console.log(c('dim', `      Lifetime deliberations: ${info.stats.totalDeliberations} (${info.stats.completed} completed)`));
  for (const ep of info.endpoints) {
    console.log(c('dim', `      - ${ep.method} ${ep.path.padEnd(22)} ${ep.price}`));
  }

  // ── Step 2: paid deliberation submission ─────────────────────────────
  // The server now holds the HTTP connection open for up to 90s waiting for
  // workers to finish. If the tally lands inside that window, the response
  // is a 200 with the full verdict inline — single payment, zero polling.
  // If the server times out first, we get a 202 with just the delib id and
  // fall back to the paid /x402/verdict/:id polling loop (crash recovery).
  console.log(c('blue', '\n[3/4] Submitting proposal for deliberation (paying $0.01 USDC)...'));
  console.log(c('yellow', `      Proposal: ${DEFAULT_PROPOSAL.slice(0, 100)}${DEFAULT_PROPOSAL.length > 100 ? '…' : ''}`));
  console.log(c('dim', '      Waiting for workers to deliberate (connection stays open)...'));

  type VerdictResponse = {
    deliberationId: string;
    status: string;
    proposal: string;
    stellarPaymentTx: string | null;
    nearProposalId: number | null;
    verdict?: {
      decision: string;
      approved: number;
      rejected: number;
      workerCount: number;
      aggregatedValue: number;
      workers: Array<{ workerId: string; output: { vote?: string; reasoning?: string } }>;
    };
    error?: string;
  };

  const t0 = Date.now();
  const deliberateRes = await fetchWithPay(`${DELIBERA_SERVER_URL}/x402/deliberate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proposal: DEFAULT_PROPOSAL,
      context: DEFAULT_CONTEXT,
    }),
  });
  if (!deliberateRes.ok && deliberateRes.status !== 202 && deliberateRes.status !== 422) {
    const errText = await deliberateRes.text();
    console.error(c('red', `ERROR: /x402/deliberate returned ${deliberateRes.status}: ${errText}`));
    process.exit(1);
  }
  const deliberate = (await deliberateRes.json()) as VerdictResponse;
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  let finalVerdict: VerdictResponse | null = null;

  if (deliberateRes.status === 200 && deliberate.verdict) {
    // Fast path: the coordinator returned the full verdict inline. No polling.
    console.log(c('green', `      ✓ Paid + deliberation completed in ${elapsed}s`));
    console.log(c('dim', `      Deliberation id:    ${deliberate.deliberationId}`));
    console.log(c('dim', `      Stellar payment tx: ${deliberate.stellarPaymentTx ?? '(not in response headers)'}`));
    console.log(c('dim', `      NEAR proposal id:   ${deliberate.nearProposalId ?? 'n/a'}`));
    finalVerdict = deliberate;
    console.log(c('blue', '\n[4/4] Verdict returned inline — skipping poll loop (no extra $0.002 charges).'));
  } else if (deliberateRes.status === 422) {
    // Inline failure (coordinator returned null or threw inside the window).
    console.log(c('red', `      ✗ Deliberation failed inline in ${elapsed}s`));
    console.log(c('dim', `      Deliberation id: ${deliberate.deliberationId}`));
    console.log(c('dim', `      Error:           ${deliberate.error ?? 'unknown'}`));
    finalVerdict = deliberate;
  } else {
    // Fallback path: server closed the response before workers finished.
    // Recover via the paid verdict endpoint — existing polling behavior.
    console.log(c('yellow', `      ⧖ Paid + accepted in ${elapsed}s, but coordinator did not return inline`));
    console.log(c('dim', `      Deliberation id:    ${deliberate.deliberationId}`));
    console.log(c('dim', `      Stellar payment tx: ${deliberate.stellarPaymentTx ?? '(not in response headers)'}`));
    console.log(c('dim', `      Status:             ${deliberate.status}`));

    console.log(c('blue', `\n[4/4] Falling back to paid verdict polling (each poll $0.002 USDC, max ${MAX_POLLS} polls)...`));
    for (let i = 0; i < MAX_POLLS; i++) {
      if (i > 0) await sleep(POLL_DELAY_MS);
      console.log(c('dim', `      Poll ${i + 1}/${MAX_POLLS}...`));
      const verdictRes = await fetchWithPay(
        `${DELIBERA_SERVER_URL}/x402/verdict/${deliberate.deliberationId}`,
      );
      if (verdictRes.status === 202) {
        const pending = (await verdictRes.json()) as { status: string };
        console.log(c('yellow', `         pending — workers still deliberating (${pending.status})`));
        continue;
      }
      if (verdictRes.status === 404) {
        console.error(c('red', '      Deliberation id not found. The coordinator may have restarted.'));
        process.exit(1);
      }
      if (!verdictRes.ok && verdictRes.status !== 422) {
        const errText = await verdictRes.text();
        console.error(c('red', `      ERROR: /x402/verdict returned ${verdictRes.status}: ${errText}`));
        process.exit(1);
      }
      finalVerdict = (await verdictRes.json()) as VerdictResponse;
      console.log(c('green', '         ✓ Terminal state reached'));
      break;
    }
  }

  // ── Step 4: print results ────────────────────────────────────────────
  console.log('');
  console.log(c('bold', '════════════════════════════ VERDICT ════════════════════════════'));
  if (!finalVerdict) {
    console.log(c('yellow', 'Deliberation did not complete within poll window.'));
    console.log(c('dim', `The deliberation is likely still running. Pay $0.002 again to check:`));
    console.log(c('dim', `  curl ${DELIBERA_SERVER_URL}/x402/verdict/${deliberate.deliberationId}`));
    return;
  }
  if (finalVerdict.status === 'failed') {
    console.log(c('red', `Status:    FAILED`));
    console.log(c('red', `Reason:    ${finalVerdict.error ?? 'unknown'}`));
    return;
  }
  const v = finalVerdict.verdict!;
  console.log(c('bold', `Decision:  ${v.decision === 'Approved' ? c('green', v.decision) : c('red', v.decision)}`));
  console.log(`Approved:  ${c('green', String(v.approved))}  |  Rejected: ${c('red', String(v.rejected))}  |  Workers: ${v.workerCount}`);
  console.log(c('dim', `Aggregate: ${v.aggregatedValue}`));
  console.log('');
  console.log(c('bold', 'Worker reasoning:'));
  for (const worker of v.workers ?? []) {
    const voteColor = worker.output?.vote === 'Approved' ? 'green' : 'red';
    console.log(`  ${c('magenta', worker.workerId)} → ${c(voteColor, worker.output?.vote ?? '(no vote)')}`);
    if (worker.output?.reasoning) {
      const preview = worker.output.reasoning.slice(0, 200);
      console.log(c('dim', `    ${preview}${worker.output.reasoning.length > 200 ? '…' : ''}`));
    }
  }
  console.log('');
  console.log(c('bold', 'Cross-chain audit trail:'));
  console.log(c('dim', `  Stellar payment tx: ${finalVerdict.stellarPaymentTx ?? 'n/a'}`));
  console.log(c('dim', `  NEAR proposal id:   ${finalVerdict.nearProposalId ?? 'n/a'}`));
  console.log('');
  console.log(c('bold', 'Cost summary:'));
  // Inline path pays $0.01 once. Fallback polling path pays $0.01 + N × $0.002.
  // We infer which path we took from whether the deliberate response already
  // carried the verdict (status 200 + verdict field).
  const usedInline = deliberateRes.status === 200 && Boolean(deliberate.verdict);
  if (usedInline) {
    console.log(c('dim', `  $0.01 deliberate (verdict returned inline) = ~$0.010 USDC`));
  } else {
    const polls = 1; // at minimum one poll landed the verdict
    const totalUsd = 0.01 + 0.002 * polls;
    console.log(c('dim', `  $0.01 deliberate + ${polls} × $0.002 verdict poll = ~$${totalUsd.toFixed(3)} USDC`));
  }
  console.log(c('dim', `  Stellar network fees: $0 (sponsored by OZ Channels)`));
  console.log('');
  console.log(c('green', '✓ Demo complete.'));
}

main().catch((err) => {
  console.error(c('red', '\nFATAL:'), err);
  process.exit(1);
});
