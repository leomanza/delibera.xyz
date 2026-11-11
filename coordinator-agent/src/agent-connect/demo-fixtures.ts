/**
 * demo-fixtures.ts — REAL receipts harvested read-only from the live runs of
 * 2026-10-19 (Agent Connect GET /v1/status + /v1/policy, and the testnet
 * verdict contract). Used by the demo's replay mode so the UI shows the exact
 * shape of real operations with real verifiable ids — without moving funds.
 *
 * All values below were fetched live; "replay" flags mark reconstructed
 * narrative pieces (e.g. juror reasoning summaries) vs on-chain receipts.
 */

export const AGENT = {
  agentId: 'c6b8a14d6b2fdd22e6a8c5182955f1dbca86453d71de4ce3e6cf8c96613ed889',
  nearAccountId: '1688bff53d186ab9981666521f25154001ea6805fa2c6a1175677ba8ea375075',
  grantLabel: 'delibera-demo-session',
  walletId: '0f7b973a-c8a4-4a1d-8a1f-5f31c026bb11',
};

export const RECEIPTS = {
  network: {
    overall: 'operational',
    contract: 'outlayer.near',
    components: ['one_click', 'custody', 'near'],
    checkedAt: '2026-10-20T20:46:02.141Z',
  },
  policy: {
    revision: 4,
    policyHash: 'a435476dd5b4f903c1b5e91f3c732ac66d976ec4355684af0293c04169d3e3ed',
    status: 'APPLIED',
    providerPolicySynced: true,
    appliedAt: '2026-10-19T21:17:54.799Z',
    dailyBudget: { limitUsd: '0.20', spentUsd: '0.019998', remainingUsd: '0.180002' },
  },
  balances: { public: '20000', confidential: '0' }, // atomic USDC (6dp): $0.02 public
  oraclePayment: {
    correlationId: 'op_znmV72z58DUDuzbF7WmihhMLTiCm8aGL3C_KnUmKF_A',
    action: 'confidential_transfer',
    provider: 'outlayer',
    providerStatus: 'success',
    amountAtomic: '10000',
    intentHash: 'FMhVyes17dTzH2QSnLRie6cjNxhTzKJaPj2YpQfpxhDW',
    depositAddress: '5d06ea0d0ed987bf80d40e688a3c84154fe7abdbddbd1944ce83a71a7826e675',
    timeline: [
      { status: 'PENDING', at: '2026-10-19T19:53:25.208Z' },
      { status: 'PROCESSING', at: '2026-10-19T19:53:26.233Z', label: 'dispatch committed' },
      { status: 'SUCCESS', at: '2026-10-19T19:53:48.123Z', label: 'provider settled' },
    ],
  },
  vendorPayment: {
    correlationId: 'op_XqAFcciijdn1s7ftjMfUBRZ2Z3ejkrH6bk247QS_Pqw',
    action: 'intents_transfer',
    provider: 'outlayer',
    providerStatus: 'success',
    amountAtomic: '10000',
    intentHash: '1YVrHHsq2QnzWQKb9Y8199AF75SGwabig3VZWak7i43',
    timeline: [
      { status: 'PENDING', at: '2026-10-19T21:17:55.689Z' },
      { status: 'PROCESSING', at: '2026-10-19T21:17:56.555Z', label: 'dispatch committed' },
      { status: 'UNCERTAIN', at: '2026-10-19T21:18:00.000Z', label: 'maybe executed — poll, never resubmit' },
      { status: 'SUCCESS', at: '2026-10-19T21:19:42.243Z', label: 'intents_transfer settled' },
    ],
  },
  verdict: {
    proposalId: 74,
    state: 'Finalized',
    decision: 'Approved',
    approved: 3,
    rejected: 0,
    workerCount: 3,
    quorum: 2,
    minWorkers: 3,
    settledOn: 'coordinator.agents-coordinator.testnet',
    settledAt: '2026-10-19T21:17:02.569Z',
    proposalText:
      'Pay vendor.near 20 USDC for the completed Q3 community-docs security review. Deliverable published and verified, two milestones met on time, final report attached, amount matches the approved quote.',
    workers: [
      { did: 'did:key:z6Mkpp7u6Nnp86vX79LnRFKmLcxLnhA1geQXtvqgdATE6TsY', resultHash: '1b7fdc32cddbc0705b5be6a32f54827eb96debff244d1e237df3ec9c938c8368', name: 'Juror 1', vote: 'Approved' },
      { did: 'did:key:z6MkuLv3ysAUfL2nRRPUVdsxNbZqukfwBUd9eS7dzd1WWqYv', resultHash: 'e182a3ad8cbf28f67e186ac634455671ce8a64efb6b8333808ff805785b23c87', name: 'Juror 2', vote: 'Approved' },
      { did: 'did:key:z6MktUzP9U4gmN5RABfdRBmjfwtXuyqtk76kMW4RSJat1ftZ', resultHash: '81938681ae45ca9d7cca13124b2590c10db5aeaa0214eecf39e1bedafa6d8790', name: 'Juror 3', vote: 'Approved' },
    ],
  },
  refusal: {
    http: 403,
    code: 'policy_destination_denied',
    layer: 'owner-signed destinations — checked by the Agent Connect API before dispatch',
    message: 'ac-owner.delibera.near is not on the owner-signed whitelist',
    replayNote: 'Only an owner-signed policy_update opens a destination. Replaying with the same key returns the original refusal, a new key cannot bypass it either.',
  },
  signature: {
    standard: 'nep413',
    tag: '2147484061',
    sha256: true,
    recipient: 'api.demo.agentsonintents.com',
    nonceBytes: 32,
    replayed: true,
    messageTemplate: (vendor: string) =>
      `[delibera demo] Add ${vendor} to the destinations of agent ${AGENT.agentId} — policy revision 4. Approved by council verdict #74.`,
  },
  explorer: {
    agentAccount: 'https://nearblocks.io/address/1688bff53d186ab9981666521f25154001ea6805fa2c6a1175677ba8ea375075',
    intentsContract: 'https://nearblocks.io/address/outlayer.near',
    verdictContract: 'https://testnet.nearblocks.io/address/coordinator.agents-coordinator.testnet',
  },
};

/** Representative juror reasoning (REPLAY — the real votes/DIDs/hashes above are
 *  the settled on-chain receipts; full verbatim reasoning lives in the verdict
 *  record at run time). */
export const JUROR_REASONING = (proposalText: string) => [
  { name: 'Juror 1', vote: 'Approved', reasoning: `Named payee, published deliverable, and the amount matches the approved quote. Two milestones are evidenced as met on time. ${proposalText.slice(0, 0)}Accountability checks pass — approve.`.trim() },
  { name: 'Juror 2', vote: 'Approved', reasoning: 'The deliverable is stated as published and verified, and the spend fits the request the owner pre-approved the shape of. Without an anonymous recipient or unverifiable work, the request is fundable.' },
  { name: 'Juror 3', vote: 'Approved', reasoning: 'Sufficient accountability: named vendor, verified deliverable, milestones met. Approve — with the note that any change to amount or payee would need re-deliberation.' },
];

export const PRESETS = [
  {
    id: 'grant',
    label: 'Foundation grant — milestone payout',
    text: 'Proposal: release $20 USDC milestone 3 to grantee publicgoods.da worker who built the open-data pipeline. Deliverable: pipeline merged, docs live, two prior milestones verified. Amount matches the grant agreement quote.',
  },
  {
    id: 'payroll',
    label: 'Treasury — contractor payroll line',
    text: 'Proposal: Pay vendor.near 20 USDC for the completed Q3 community-docs security review. Deliverable published and verified, two milestones met on time, final report attached, amount matches the approved quote.',
  },
  {
    id: 'anon',
    label: 'Flagged — anonymous transfer',
    text: 'Proposal: Transfer 20 USDC to an anonymous account with no named recipient, no deliverable, no milestones, and no accountability mechanism. Justification: trust me.',
  },
];
