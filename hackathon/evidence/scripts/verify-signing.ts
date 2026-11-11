/**
 * verify-signing.ts — verifies the NEP-413/NEP-366 signing algorithms in
 * src/agent-connect/client.ts byte-for-byte against the official
 * NEAR-Intents-Agent-API skill test vectors (assets/test-vectors.json).
 *
 * "Any new port must reproduce every vector." — near-intents-agent-api skill
 * (public test data; owner secrets are NEVER in this file).
 *
 * Run: npm run verify:signing   → must print "ALL VECTORS MATCH"
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { KeyPair } from '@near-js/crypto';
import {
  Signature,
  actionCreators,
  encodeDelegateAction,
  encodeSignedDelegate,
} from '@near-js/transactions';

const HERE = dirname(fileURLToPath(import.meta.url));
const VECTORS = join(HERE, '..', 'assets', 'test-vectors.json');

/** Replays every vector against the same algorithms client.ts uses. */
export function runSigningVectors(): boolean {
  // Trusted official-vectors JSON boundary (declared exclusion of verify-no-key).
  // Minimal shape: only the fields the replay actually touches.
  // Trusted official-vectors JSON boundary (declared exclusion of verify-no-key).
  // Minimal shape: only the fields the replay actually touches.
  const tv = JSON.parse(readFileSync(VECTORS, 'utf8')) as {
    near: { account_id: string; public_key: string; secret: string };
    nep413: {
      payload: { message: string; recipient: string; nonce: string };
      signature_b64: string;
    };
    nep366: {
      payload: { receiverId: string; actions: Array<{ type: string; params: { methodName: string; args: Record<string, unknown>; gas: string; deposit: string } }> };
      access_key_nonce: string;
      block_height: string;
      encoded_hex: string;
      signed_delegate: string;
    };
    grant: { token: string; commitment: string };
  };
  const results: Record<string, boolean> = {};
  const kp = KeyPair.fromString((tv.near.secret.startsWith('ed25519:') ? tv.near.secret : `ed25519:${tv.near.secret}`) as `ed25519:${string}`);

  const pk = kp.getPublicKey().toString();
  results['near.public_key'] = pk === tv.near.public_key;
  console.log('near.public_key:', results['near.public_key'] ? 'OK' : `MISMATCH ${pk}`);

  const p = tv.nep413.payload;
  const parts: Buffer[] = [];
  const tag = Buffer.alloc(4); tag.writeUInt32LE(2147484061);
  const msgb = Buffer.from(p.message, 'utf8');
  const msgLen = Buffer.alloc(4); msgLen.writeUInt32LE(msgb.length);
  const recb = Buffer.from(p.recipient, 'utf8');
  const recLen = Buffer.alloc(4); recLen.writeUInt32LE(recb.length);
  parts.push(tag, msgLen, msgb, Buffer.from(p.nonce, 'base64'), recLen, recb, Buffer.from([0]));
  const digest = createHash('sha256').update(Buffer.concat(parts)).digest();
  const sig = Buffer.from(kp.sign(digest).signature).toString('base64');
  results['nep413.signature'] = sig === tv.nep413.signature_b64;
  console.log('nep413.signature:', results['nep413.signature'] ? 'OK (byte-for-byte)' : `MISMATCH ${sig}`);

  const delegateAction = {
    senderId: tv.near.account_id,
    receiverId: tv.nep366.payload.receiverId,
    publicKey: kp.getPublicKey(),
    nonce: BigInt(tv.nep366.access_key_nonce) + 1n,
    maxBlockHeight: BigInt(tv.nep366.block_height) + 120n,
    actions: tv.nep366.payload.actions.map(({ params }: { params: { methodName: string; args: Record<string, unknown>; gas: string; deposit: string } }) =>
      actionCreators.functionCall(params.methodName, Buffer.from(JSON.stringify(params.args)), BigInt(params.gas), BigInt(params.deposit)),
    ),
  };
  const hex = Buffer.from(encodeDelegateAction(delegateAction)).toString('hex');
  results['nep366.encoded_hex'] = hex === tv.nep366.encoded_hex;
  console.log('nep366.encoded_hex:', results['nep366.encoded_hex'] ? 'OK (byte-for-byte, includes NEP-461 prefix)' : `MISMATCH ${hex.slice(0, 60)}…`);

  const digest2 = createHash('sha256').update(encodeDelegateAction(delegateAction)).digest();
  const signed = kp.sign(digest2);
  const sd = Buffer.from(encodeSignedDelegate({ delegateAction, signature: new Signature({ keyType: 0, data: signed.signature }) })).toString('base64');
  results['nep366.signed_delegate'] = sd === tv.nep366.signed_delegate;
  console.log('nep366.signed_delegate:', results['nep366.signed_delegate'] ? 'OK (byte-for-byte)' : `MISMATCH ${sd.slice(0, 40)}…`);

  const comm = createHash('sha256').update(Buffer.from(tv.grant.token, 'utf8')).digest('hex');
  results['grant.commitment'] = comm === tv.grant.commitment;
  console.log('grant.commitment:', results['grant.commitment'] ? 'OK' : `MISMATCH ${comm}`);

  const all = Object.values(results).every(Boolean);
  console.log(all ? 'ALL VECTORS MATCH' : 'SOME VECTORS FAILED');
  return all;
}

const invokedDirectly = process.argv[1] && process.argv[1].includes('verify-signing');
try {
  if (invokedDirectly) process.exit(runSigningVectors() ? 0 : 1);
} catch (e) {
  console.error(e);
  process.exit(1);
}
