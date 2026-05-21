// Discover the local-dev agent account that coordinator-agent's ShadeClient.create()
// will derive from the sponsor credentials. Same logic as coordinator-agent/src/index.ts:54-78.
import { ShadeClient } from '@neardefi/shade-agent-js';
import fs from 'node:fs';

const credsFile = `${process.env.HOME}/.near-credentials/testnet/coord-factory.agents-coordinator.testnet.json`;
const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));

const agent = await ShadeClient.create({
  networkId: 'testnet',
  agentContractId: 'agent-registry.agents-coordinator.testnet',
  sponsor: {
    accountId: 'coord-factory.agents-coordinator.testnet',
    privateKey: creds.private_key,
  },
  derivationPath: creds.private_key, // same as coordinator-agent/src/index.ts:75
});

console.log('AGENT_ACCOUNT_ID=' + agent.accountId());
