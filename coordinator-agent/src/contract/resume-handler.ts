import { deliberaView, deliberaCall } from './delibera-client';

/**
 * Resume the coordinator contract with aggregated results.
 * Uses delibera-client (near-api-js path) to call the Delibera coordinator contract.
 * Per coordinator architecture spec Q2=(a), this is separate from the agent-registry
 * contract that ShadeClient targets.
 */
export async function resumeContract(
  proposalId: number,
  aggregatedResult: string,
  configHash: string,
  resultHash: string,
): Promise<void> {
  try {
    console.log(`\nCalling coordinator_resume on contract...`);

    await deliberaCall('coordinator_resume', {
      proposal_id: proposalId,
      aggregated_result: aggregatedResult,
      config_hash: configHash,
      result_hash: resultHash,
    });

    console.log(`Successfully resumed contract for proposal #${proposalId}`);
  } catch (error) {
    console.error(`Failed to resume contract for proposal #${proposalId}:`, error);
    throw error;
  }
}

/**
 * Get finalized coordination result from contract
 */
export async function getFinalizedResult(proposalId: number): Promise<string | null> {
  try {
    const result = await deliberaView<string>('get_finalized_coordination', {
      proposal_id: proposalId,
    });
    return result ?? null;
  } catch (error) {
    console.error(`Failed to get finalized result for proposal #${proposalId}:`, error);
    return null;
  }
}
