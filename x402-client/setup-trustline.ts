/**
 * Helper: add a USDC trustline to the Stellar account in STELLAR_PRIVATE_KEY.
 *
 * Run once per fresh wallet before running the x402 demo. The buyer wallet
 * needs a USDC trustline to hold the balance it will pay out, and the server
 * (payTo) wallet needs one to receive the payment.
 *
 * Usage:
 *   STELLAR_PRIVATE_KEY=S... npx tsx setup-trustline.ts
 *
 * After the trustline is in place, get USDC from https://faucet.circle.com/
 * (select Stellar testnet) for the buyer wallet.
 */

import { config as loadEnv } from 'dotenv';
import * as StellarSdk from '@stellar/stellar-sdk';

loadEnv();

// Testnet USDC classic asset issuer (wrapped in the Soroban SAC contract).
// The SAC at CBIELTK6... operates on this underlying classic asset.
const USDC_ISSUER_TESTNET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

async function main(): Promise<void> {
  const secret = process.env.STELLAR_PRIVATE_KEY;
  if (!secret) {
    console.error('ERROR: set STELLAR_PRIVATE_KEY in .env or the environment');
    process.exit(1);
  }
  const keypair = StellarSdk.Keypair.fromSecret(secret);
  console.log(`Setting up USDC trustline for ${keypair.publicKey()}`);

  const horizon = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
  const account = await horizon.loadAccount(keypair.publicKey()).catch(() => {
    console.error(
      `ERROR: account ${keypair.publicKey()} is not yet funded. Run:\n  curl "https://friendbot.stellar.org?addr=${keypair.publicKey()}"`,
    );
    process.exit(1);
  });

  const asset = new StellarSdk.Asset('USDC', USDC_ISSUER_TESTNET);

  // Idempotent — if the trustline already exists, skip to avoid paying fees.
  const existing = account.balances.find(
    (b) => b.asset_type === 'credit_alphanum4' && b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER_TESTNET,
  );
  if (existing) {
    console.log(`USDC trustline already present. Balance: ${existing.balance}`);
    console.log(
      `\nGet testnet USDC from https://faucet.circle.com/ (select Stellar testnet, paste: ${keypair.publicKey()})`,
    );
    return;
  }

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(StellarSdk.Operation.changeTrust({ asset }))
    .setTimeout(30)
    .build();
  tx.sign(keypair);

  console.log('Submitting trustline transaction...');
  const result = await horizon.submitTransaction(tx);
  console.log(`✓ Trustline created: ${result.hash}`);
  console.log(
    `\nGet testnet USDC from https://faucet.circle.com/ (select Stellar testnet, paste: ${keypair.publicKey()})`,
  );
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
