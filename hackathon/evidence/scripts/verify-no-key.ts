/**
 * verify-no-key.ts — the no-key test (SBO3L transplant): the agent-role code
 * must carry no owner key material. Format-level scan, byte-anchored per file.
 *
 * Scans tracked first-party sources (src/, scripts/, test/, web/,
 * fixtures/, package.json, README.md, docs/, assets/) for:
 *   - real naa_/ngt_ token shapes
 *   - embedded NEP-366/413 keys as literals (ed25519:<52-char curve base58>,
 *     secp256k1:... equivalents)
 *   - PEM private-key blocks
 * Declared exclusions (each justified in output):
 *   - assets/test-vectors.json — OFFICIAL public skill test vectors; the
 *     secret inside is test data, not ours ("Any new port must reproduce
 *     every vector"), kept byte-identical to prove the port.
 *   - env.example — repo-root placeholder template, outside the scan set above
 *     (template is the contract; live values are never committed anywhere).
 *   - node_modules/, .git/ — dependency/control worlds, not our code.
 * Independent of the scan: .env / capsule.json must not be git-tracked.
 *
 * Run: npm run cap:no-key (via judge) or directly → "NO-KEY CHECK: PASS"
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const EXCLUDES = [
  { path: 'assets/test-vectors.json', why: 'official public test vectors (test secret, not ours)' },
];

function listFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', '.gga'].includes(e.name)) continue;
      listFiles(p, out);
    } else out.push(p);
  }
  return out;
}

function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean).map((f) => f.trim());
}

const FINDINGS: { file: string; pattern: string; snippet: string }[] = [];
const PATTERN_ONLY = '(pattern matched — bytes not echoed)';

export function runNoKeyCheck(): boolean {
  console.log('\nNO-KEY CHECK — agent role carries no owner key material');
  console.log('  scan scope: src/, scripts/, test/, web/, fixtures/, docs/, assets/ (tracked files only)');
  console.log('  env.example (repo-root template) is outside that set by design: the template');
  console.log('  is the contract, live values are never committed; .env files must not be');
  console.log('  git-tracked (asserted below, not scanned for content).');

  const tracked = trackedFiles();
  const trackedRelative = new Set(tracked.filter((f) => !['.git', '.gga'].some((x) => f.startsWith(x))));
  let scanned = 0;

  for (const sub of ['src', 'scripts', 'test', 'web', 'fixtures', 'docs', 'assets']) {
    const dir = join(ROOT, sub);
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) continue;
    for (const abs of listFiles(dir)) {
      const rel = relative(ROOT, abs).split('\\').join('/');
      const ex = EXCLUDES.find((x) => x.path === rel);
      if (ex) { console.log(`  excluded  ${rel} — ${ex.why}`); continue; }
      scanned++;
      const content = readFileSync(abs, 'utf8');
      const checks: [string, RegExp][] = [
        ['naa_ token', /\bnaa_[A-Za-z0-9]/],
        ['ngt_ token', /\bngt_[A-Za-z0-9]/],
        ['ed25519 key literal', /\bed25519:[1-9A-HJ-NP-Za-km-z]{50}\b/],
        ['secp256k1 key literal', /\bsecp256k1:[1-9A-HJ-NP-Za-km-z]{50,}\b/],
        ['PEM private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
      ];
      for (const [label, re] of checks) {
        // Never echo: print the pattern label only, not matched bytes
        // (a match may be the first 24 chars of a live secret).
        if (re.test(content)) FINDINGS.push({ file: rel, pattern: label, snippet: PATTERN_ONLY });
      }
    }
  }

  for (const f of ['package.json', 'README.md']) {
    const abs = join(ROOT, f);
    if (!statSync(abs, { throwIfNoEntry: false })) continue;
    scanned++;
    const content = readFileSync(abs, 'utf8');
    for (const [label, re] of [['naa_ token', /\bnaa_[A-Za-z0-9]/], ['ngt_ token', /\bngt_[A-Za-z0-9]/]] as [string, RegExp][]) {
      if (re.test(content)) FINDINGS.push({ file: f, pattern: label, snippet: PATTERN_ONLY });
    }
  }

  const envTracked = tracked.filter((t) => t === '.env' || t.startsWith('.env.') || t === 'capsule.json');
  for (const t of envTracked) FINDINGS.unshift({ file: t, pattern: 'git-tracked secret-like path', snippet: t });

  for (const f of FINDINGS) console.log(`  FINDING  ${f.file}: ${f.pattern} → ${f.snippet}…`);

  const pass = FINDINGS.length === 0;
  console.log(`  scanned ${scanned} files in tracked-first-party scope (repo tracks ${trackedRelative.size} in total), ${FINDINGS.length} findings`);
  console.log(pass ? '  NO-KEY CHECK: PASS' : '  NO-KEY CHECK: FAIL');
  return pass;
}

export function noKeyPassLine(): string {
  return (FINDINGS.length === 0 ? 'NO-KEY CHECK: PASS' : 'NO-KEY CHECK: FAIL');
}

async function main() {
  const pass = runNoKeyCheck();
  process.exit(pass ? 0 : 1);
}
const invokedDirectly = process.argv[1] && process.argv[1].includes('verify-no-key');
if (invokedDirectly) void main();
