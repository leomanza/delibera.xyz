/**
 * Lookup an existing deliberation verdict by id.
 *
 * Useful when the main demo's poll window expires before the verdict lands —
 * rather than re-paying $0.01 for a new deliberation, you can pay $0.002 per
 * poll to check the one you already started. This is the same x402-signed
 * GET /x402/verdict/:id call client.ts does in step 4, just standalone.
 *
 * Usage:
 *   npx tsx lookup.ts delib-mntrma47-8xoehe
 *   pnpm lookup delib-mntrma47-8xoehe
 */

import { config as loadEnv } from 'dotenv';
import { createEd25519Signer } from '@x402/stellar';
import { ExactStellarScheme } from '@x402/stellar/exact/client';
import { x402Client, wrapFetchWithPayment } from '@x402/fetch';

loadEnv();

const STELLAR_PRIVATE_KEY = process.env.STELLAR_PRIVATE_KEY ?? '';
const DELIBERA_SERVER_URL =
  process.env.DELIBERA_SERVER_URL?.replace(/\/+$/, '') ?? 'http://localhost:3000';
const STELLAR_NETWORK = 'stellar:testnet' as const;
const MAX_POLLS = Number(process.env.DELIBERA_MAX_POLLS ?? 15);
const POLL_DELAY_MS = 10_000;

async function main(): Promise<void> {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: pnpm lookup <deliberationId>');
    console.error('Example: pnpm lookup delib-mntrma47-8xoehe');
    process.exit(1);
  }
  if (!STELLAR_PRIVATE_KEY) {
    console.error('ERROR: STELLAR_PRIVATE_KEY is not set in .env');
    process.exit(1);
  }

  console.log(`Looking up deliberation ${id} on ${DELIBERA_SERVER_URL}`);
  const signer = createEd25519Signer(STELLAR_PRIVATE_KEY, STELLAR_NETWORK);
  console.log(`Buyer public key: ${signer.address}`);

  const scheme = new ExactStellarScheme(signer);
  const client = new x402Client().register(STELLAR_NETWORK, scheme);
  const fetchWithPay = wrapFetchWithPayment(fetch, client);

  const url = `${DELIBERA_SERVER_URL}/x402/verdict/${id}`;

  for (let i = 0; i < MAX_POLLS; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
    console.log(`\nPoll ${i + 1}/${MAX_POLLS}: paying $0.002 USDC...`);
    const res = await fetchWithPay(url);

    if (res.status === 202) {
      const body = (await res.json()) as { status?: string };
      console.log(`  pending — workers still deliberating (${body.status ?? 'unknown'})`);
      continue;
    }
    if (res.status === 404) {
      console.error(`  NOT FOUND — deliberation ${id} does not exist on the server`);
      console.error('  (the coordinator may have restarted since you started the demo)');
      process.exit(1);
    }
    if (!res.ok && res.status !== 422) {
      console.error(`  HTTP ${res.status}: ${await res.text()}`);
      process.exit(1);
    }

    const body = await res.json();
    console.log(`\n=== VERDICT (HTTP ${res.status}) ===`);
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  console.log(
    `\nDeliberation still pending after ${MAX_POLLS} polls — coordinator may still be running. Try again in a minute.`,
  );
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
