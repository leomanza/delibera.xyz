import { TaskStatus, CoordinatorStatus } from './constants';

/**
 * AI vote result from a worker agent
 */
export type VoteDecision = 'Approved' | 'Rejected';

export interface VoteResult {
  vote: VoteDecision;
  reasoning: string;
}

/**
 * Worker task result structure
 */
export interface WorkerResult {
  workerId: string;
  taskType: string;
  output: {
    value: number;
    vote?: VoteDecision;
    reasoning?: string;
    data?: any;
    computedAt: string;
  };
  processingTime?: number;
  /**
   * The TEE proof for this reasoning. It travels INSIDE the result so the
   * on-chain result_hash — which commits to these exact bytes — binds the
   * sealed reasoning to the attestation that produced it.
   */
  verificationProof?: VerificationProof;
}

/**
 * Vote tally from coordinator (full detail, stored in Ensue only)
 */
export interface TallyResult {
  aggregatedValue: number;
  approved: number;
  rejected: number;
  decision: VoteDecision;
  workerCount: number;
  workers: WorkerResult[];
  timestamp: string;
  proposalId?: number;
  /** DID → display name map for all participating workers */
  workerNames?: Record<string, string>;
}

/**
 * On-chain result: only the tally, NO individual worker reasoning
 * Worker-level reasoning stays private in Ensue shared memory
 */
export interface OnChainResult {
  aggregatedValue: number;
  approved: number;
  rejected: number;
  decision: VoteDecision;
  workerCount: number;
  timestamp: string;
  proposalId: number;
}

/**
 * Task configuration passed to workers
 */
export interface TaskConfig {
  type: string;
  parameters?: Record<string, any>;
  timeout?: number;
}

/**
 * Proposal lifecycle states (matches contract ProposalState enum)
 */
export type ProposalState = 'Created' | 'WorkersCompleted' | 'Finalized' | 'TimedOut';

/**
 * Worker submission recorded on-chain (nullifier only — no vote data).
 * Individual votes stay private in Ensue shared memory.
 */
export interface WorkerSubmission {
  worker_id: string;
  result_hash: string;
  timestamp: number;
}

/**
 * Input for recording worker submissions (nullifier)
 */
export interface WorkerSubmissionInput {
  worker_id: string;
  result_hash: string;
}

/**
 * Unified proposal from contract (replaces separate pending/finalized)
 */
export interface Proposal {
  yield_id?: string;
  task_config: string;
  config_hash: string;
  timestamp: number;
  requester: string;
  state: ProposalState;
  worker_submissions: WorkerSubmission[];
  finalized_result?: string;
}

/**
 * Coordination request from contract (backwards-compatible alias)
 */
export interface CoordinationRequest {
  proposal_id: number;
  task_config: string;
  config_hash: string;
  timestamp: number;
}

/**
 * Worker status information
 */
export interface WorkerStatusInfo {
  workerId: string;
  status: TaskStatus;
  timestamp?: number;
  error?: string;
}

/**
 * Coordinator status information
 */
export interface CoordinatorStatusInfo {
  status: CoordinatorStatus;
  proposalId?: number;
  timestamp: number;
}

/**
 * Ensue memory item
 */
export interface EnsueMemory {
  key: string;
  value: string;
  description?: string;
}

/**
 * Ensue API response for reading memory
 */
export interface EnsueReadResponse {
  memories: Array<{
    key: string;
    value: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
  }>;
}

/**
 * Ensue API response for listing keys
 */
export interface EnsueListResponse {
  keys: string[];
  total: number;
}

/**
 * NEAR AI model verification proof.
 * Cryptographic proof of which AI model was used for a vote,
 * without exposing the actual vote content.
 * See: https://docs.near.ai/cloud/verification/chat
 */
export interface VerificationProof {
  chat_id: string;
  model: string;
  request_hash: string;
  response_hash: string;
  signature: string;
  signing_address: string;
  signing_algo: string;
  timestamp: number;
  attestation?: ModelAttestation;
  /** The signed payload verbatim ("request_hash:response_hash"). */
  text?: string;
  /** Exact bytes sent to /v1/chat/completions — lets a buyer re-derive request_hash. */
  request_body?: string;
  /** Exact bytes received — lets a buyer re-derive response_hash. */
  response_body?: string;
}

/**
 * NEAR AI model attestation report.
 * Links a signing_address back to verified TEE hardware (Intel TDX / NVIDIA).
 * See: https://docs.near.ai/cloud/verification/chat
 */
export interface ModelAttestation {
  signing_address: string;
  model: string;
  nonce: string;
  /** The Intel TDX quote (hex) — verified locally with nearai-cloud-verifier. */
  attestation_report: string;
  attestation_type?: string;
  /** Serving provider reported by the API ("near" or the attested fallback "chutes"). */
  provider?: string | null;
  /** Server-side verdict for the model attestation. */
  model_verified?: boolean | null;
  /** Trusted-computing-base status reported by the API. */
  tcb_status?: string | null;
  /** NVIDIA GPU attestation verdict reported by the API. */
  gpu_verdict?: string | null;
  /** GPU attestation evidence as returned by the API (certificates, per-GPU records). */
  gpu_evidence?: unknown;
  /** The model-side TDX quote (base64). */
  model_quote_b64?: string | null;
  /** The serving certificate (base64). */
  model_certificate_b64?: string | null;
  /** report_data = signing_address || nonce — binds the quote to this key. */
  report_data?: string | null;
}
