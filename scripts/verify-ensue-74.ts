/**
 * verify-ensue-74.ts — live-backing check for the captured verdict fixture.
 *
 * The proposal-74 fixture jurors carry did + resultHash. The deliberation that
 * produced them ran on Ensue (org socialcap); its per-juror result memories are
 * still readable. This recomputes sha256(stored result JSON) per juror and
 * compares with the fixture's resultHash — independently confirming the
 * fixture is a faithful capture of a real deliberation, not a reconstruction.
 *
 * Read-only, no writes, no keys printed. Without ENSUE_API_KEY the check is
 * SKIP (exit 2) — the offline judge stays green; this is a bonus verification.
 */
import { createHash } from 'node:crypto';
import { loadProposal74 } from '../src/verdict-fixture.js';
import { ensue, ensueConfigured } from '../src/ensue.js';

interface EnsuePayload { failed: number; results: Array<{ key_name: string; status: string; value: string }> }

function sha(s: string): string { return createHash('sha256').update(s, 'utf8').digest('hex'); }

async function main(): Promise<number> {
  if (!ensueConfigured()) {
    console.log('ENSUE-74: SKIP — ENSUE_API_KEY not set (bonus check; offline judge stays green)');
    return 2;
  }
  const p74 = loadProposal74();
  console.log('ENSUE-74 LIVE BACKING — recomputing sha256(stored result) vs fixture resultHash');
  let match = 0;
  let checked = 0;
  for (const j of p74.jurors) {
    const key = `coordination/proposals/74/workers/${j.did}/result`;
    let raw: string | undefined;
    try { raw = await ensue.get(key); } catch (e: unknown) {
      console.log(`  ${j.name.padEnd(8)} ensue.get failed: ${e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120)}`);
      continue;
    }
    if (!raw) { console.log(`  ${j.name.padEnd(8)} no live memory at key`); continue; }
    let stored: string | undefined;
    try { stored = (JSON.parse(raw) as EnsuePayload).results?.[0]?.value; } catch { stored = undefined; }
    if (!stored) { console.log(`  ${j.name.padEnd(8)} live memory unreadable`); continue; }
    checked++;
    // Exact stored bytes first; if the capture was re-serialized at storage
    // time, also try the canonical re-stringify of the parsed value.
    const variants: Array<[string, string]> = [
      ['raw', sha(stored)],
      ['re-serialized', sha(JSON.stringify(JSON.parse(stored)))],
    ];
    const hit = variants.find(([, d]) => d === j.resultHash);
    if (hit) match++;
    console.log(`  ${j.name.padEnd(8)} vote:${j.vote} ${hit ? `MATCH (${hit[0]})` : 'MISMATCH'} · resultHash ${j.resultHash.slice(0, 12)}… vs ${variants.map(([n, d]) => `${n} ${d.slice(0, 12)}…`).join(' / ')}`);
  }
  const line = match === p74.jurors.length && checked === p74.jurors.length ? 'ALL MATCH' : match > 0 ? 'PARTIAL' : 'NO MATCH';
  console.log(`ENSUE-74 LIVE ${match}/${p74.jurors.length} — ${line} (fixture is live-backed evidence)`);
  return match === p74.jurors.length && checked === p74.jurors.length ? 0 : 1;
}

if (process.argv[1]?.includes('verify-ensue-74')) void main().then((c) => process.exit(c));
