/**
 * make-capsule.ts — prints the cso-capsule/1 evidence envelope and (optionally)
 * writes it to capsule.json (`--out capsule.json`).
 *
 * Run: npm run capsule
 */
import { writeFileSync } from 'node:fs';
import { buildCapsule } from '../src/capsule.js';

const capsule = buildCapsule();
const json = JSON.stringify(capsule, null, 2) + '\n';

if (process.argv.includes('--out')) {
  const idx = process.argv.indexOf('--out');
  const target = process.argv[idx + 1] || 'capsule.json';
  writeFileSync(target, json);
  console.log(`wrote ${target} (${capsule.spec}, ${capsule.fixtures.length} fixtures)`);
} else {
  process.stdout.write(json);
}
