/**
 * One-shot manual finalize for stakeholder demo.
 *
 * Reads pre-warmed worker votes from Ensue, calls record_worker_submissions +
 * coordinator_resume on-chain. Demo-only orchestration; production uses the
 * coord-agent's normal flow.
 *
 * Usage:
 *   cd coordinator-agent
 *   node finalize-manual.mjs <proposal_id>
 *
 * Assumes:
 *  - .env.development.local is configured (AGENT_CONTRACT_ID, SPONSOR_*, ENSUE_API_KEY, NEXT_PUBLIC_contractId)
 *  - The proposal is in `Created` state on `coordinator.agents-coordinator.testnet`
 *  - All workers' votes are already populated in Ensue at coordination/tasks/{worker_did}/result
 */
import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' });
import crypto from 'crypto';

const proposalId = parseInt(process.argv[2]);
if (!proposalId) {
  console.error('Usage: node finalize-manual.mjs <proposal_id>');
  process.exit(1);
}

const NETWORK_ID = (process.env.NEAR_NETWORK || 'testnet');
const COORDINATOR_CONTRACT = process.env.NEXT_PUBLIC_contractId || 'coordinator.agents-coordinator.testnet';
const REGISTRY_CONTRACT = process.env.REGISTRY_CONTRACT_ID || 'registry.agents-coordinator.testnet';
const NEAR_RPC = process.env.NEAR_RPC_JSON || 'https://test.rpc.fastnear.com';
const ENSUE_API_KEY = process.env.ENSUE_API_KEY;
const ENSUE_ORG = process.env.ENSUE_COORDINATOR_ORG || 'socialcap';

console.log('Demo finalize script — proposal #' + proposalId);
console.log('Coordinator contract:', COORDINATOR_CONTRACT);

// 1. Look up the proposal on-chain (need config_hash + expected_worker_count)
async function nearView(contract, method, args = {}) {
  const res = await fetch(NEAR_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: '1', method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: contract,
        method_name: method,
        args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      },
    }),
  });
  const data = await res.json();
  if (data.error || data.result?.error) {
    throw new Error(`view ${method}: ${JSON.stringify(data.error || data.result.error)}`);
  }
  return JSON.parse(Buffer.from(data.result.result).toString());
}

const proposal = await nearView(COORDINATOR_CONTRACT, 'get_proposal', { proposal_id: proposalId });
console.log('Proposal state:', proposal.state);
console.log('Expected workers:', proposal.expected_worker_count);
console.log('Config hash:', proposal.config_hash);
if (proposal.state !== 'Created') {
  console.error(`Proposal not in Created state (current: ${proposal.state}) — cannot finalize`);
  process.exit(1);
}

// 2. List active workers (filter by ironclaw-demo prefix for this demo)
const workers = await nearView(REGISTRY_CONTRACT, 'list_active_workers', {});
const demoWorkers = workers.filter(w => w.cvm_id?.startsWith('ironclaw-demo-'));
console.log('Active demo workers:', demoWorkers.length);
demoWorkers.forEach(w => console.log(`  ${w.cvm_id} (${w.worker_did})`));

// 3. Read each worker's vote from Ensue
async function ensueGet(keys) {
  const res = await fetch(`https://api.ensue-network.ai/?organization=${ENSUE_ORG}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ENSUE_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'get_memory', arguments: { key_names: keys } },
    }),
  });
  const text = await res.text();
  const match = text.match(/data: (\{.*\})/);
  if (!match) throw new Error('Ensue response parse failed');
  return JSON.parse(match[1]).result?.structuredContent?.results || [];
}

const resultKeys = demoWorkers.map(w => `coordination/tasks/${w.worker_did}/result`);
const ensueResults = await ensueGet(resultKeys);

const submissions = [];
const votes = [];
for (const r of ensueResults) {
  if (r.status !== 'success' || !r.value) {
    console.error(`Missing vote at ${r.key_name}:`, r.error);
    continue;
  }
  const match = r.key_name.match(/coordination\/tasks\/([^/]+(?:\/[^/]+)?)\/result/);
  const workerDid = match ? match[1] : '';
  const resultStr = r.value;
  const resultHash = crypto.createHash('sha256').update(resultStr).digest('hex');
  submissions.push({ worker_id: workerDid, result_hash: resultHash });
  let parsed = {};
  try { parsed = JSON.parse(resultStr); } catch {}
  votes.push({ worker_id: workerDid, option: parsed.option, rationale: parsed.rationale });
  console.log(`  ${workerDid.slice(-10)}: ${parsed.option}`);
}

if (submissions.length !== proposal.expected_worker_count) {
  console.error(`Got ${submissions.length} submissions, expected ${proposal.expected_worker_count}`);
  process.exit(1);
}

// 4. Compute aggregated_result (simple tally)
const counts = {};
for (const v of votes) counts[v.option] = (counts[v.option] || 0) + 1;
const aggregated_result = JSON.stringify({ tally: counts, total: votes.length });
const result_hash = crypto.createHash('sha256').update(aggregated_result).digest('hex');
console.log('Aggregated:', aggregated_result);

// 5. Call record_worker_submissions + coordinator_resume via delibera-client (built dist)
const { deliberaCall } = await import('./dist/contract/delibera-client.js');

// We need ShadeClient initialized first
console.log('\nInitializing ShadeClient...');
const { ShadeClient } = await import('@neardefi/shade-agent-js');
const { setAgent } = await import('./dist/shade-client.js');
const agent = await ShadeClient.create({
  networkId: NETWORK_ID,
  agentContractId: process.env.AGENT_CONTRACT_ID,
  sponsor: {
    accountId: process.env.SPONSOR_ACCOUNT_ID,
    privateKey: process.env.SPONSOR_PRIVATE_KEY,
  },
  derivationPath: process.env.SPONSOR_PRIVATE_KEY,
});
setAgent(agent);
console.log('Agent:', agent.accountId());

console.log('\nCalling record_worker_submissions...');
await deliberaCall('record_worker_submissions', { proposal_id: proposalId, submissions });
console.log('✓ submissions recorded');

console.log('\nCalling coordinator_resume...');
await deliberaCall('coordinator_resume', {
  proposal_id: proposalId,
  aggregated_result,
  config_hash: proposal.config_hash,
  result_hash,
});
console.log('✓ coordinator_resume called');

// Verify
const final = await nearView(COORDINATOR_CONTRACT, 'get_proposal', { proposal_id: proposalId });
console.log('\nFinal state:', final.state);
console.log('Finalized result:', final.finalized_result);
