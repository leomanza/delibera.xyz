import { OpenAI } from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import type { VoteResult, VerificationProof, ModelAttestation } from '@delibera-xyz/shared';
import { randomBytes } from 'crypto';

/**
 * AI voter module — calls NEAR AI API to vote on proposals based on manifesto alignment.
 * Pattern from verifiable-ai-dao/src/ai.ts
 */

const SYSTEM_MESSAGE =
  'You are a Decentralized Autonomous Organization (DAO) agent with a persistent identity. ' +
  'You have your own values, accumulated knowledge, and decision history that shape your reasoning. ' +
  'Each prompt will contain your agent identity (values, guidelines, voting weights, past decisions), ' +
  'the DAO manifesto, and a proposal to vote on. ' +
  'Vote on the proposal based on BOTH the DAO manifesto AND your personal agent identity. ' +
  'Your accumulated knowledge and past decisions should inform your reasoning. ' +
  'Provide both your vote (Approved or Rejected) and a clear explanation of your reasoning. ' +
  'You must keep responses under 10,000 characters.';

export interface AiVoteResult extends VoteResult {
  verificationProof?: VerificationProof;
}

/** Wire bytes of the chat call — needed to re-verify the response signature offline. */
export interface CapturedExchange {
  requestBody: string; // exact bytes sent
  responseBody: string; // exact bytes received
}

/**
 * Wrap fetch so we keep the exact request/response bytes of the completion.
 * NEAR AI signs "sha256(requestBytes):sha256(responseBytes)" — without the
 * bytes, the signature can be checked but the hashes cannot be re-derived.
 */
function capturingFetch(captured: CapturedExchange): typeof fetch {
  return async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const res = await fetch(input, init);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (typeof init?.body === 'string' && url.includes('/chat/completions')) {
      captured.requestBody = init.body;
    }
    const clone = res.clone();
    const text = await clone.text();
    if (url.includes('/chat/completions')) captured.responseBody = text;
    return res;
  };
}

export async function aiVote(manifesto: string, proposal: string, agentContext?: string): Promise<AiVoteResult> {
  const apiKey = process.env.NEAR_AI_API_KEY || process.env.NEAR_API_KEY;
  if (!apiKey) {
    throw new Error('NEAR_AI_API_KEY or NEAR_API_KEY environment variable is not set');
  }

  const captured: CapturedExchange = { requestBody: '', responseBody: '' };
  const openai = new OpenAI({
    baseURL: 'https://cloud-api.near.ai/v1',
    apiKey,
    fetch: capturingFetch(captured),
  });

  let userMessage = '';
  if (agentContext) {
    userMessage += `${agentContext}\n\n`;
  }
  userMessage += `=== DAO MANIFESTO ===\n${manifesto}\n\n=== PROPOSAL ===\n${proposal}`;

  const model = process.env.NEAR_AI_MODEL || 'deepseek/deepseek-v3.2';

  const request: ChatCompletionCreateParamsNonStreaming = {
    model,
    tools: [
      {
        type: 'function',
        function: {
          name: 'dao_vote',
          description: 'Vote on a DAO proposal with reasoning',
          parameters: {
            type: 'object',
            properties: {
              vote: { type: 'string', enum: ['Approved', 'Rejected'] },
              reasoning: {
                type: 'string',
                description: 'Explanation for the voting decision based on the manifesto',
              },
            },
            required: ['vote', 'reasoning'],
          },
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: 'dao_vote' } },
    messages: [
      { role: 'system', content: SYSTEM_MESSAGE },
      { role: 'user', content: userMessage },
    ],
  };

  const completion = await openai.chat.completions.create(request);

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== 'function') {
    throw new Error('Expected function tool call response from AI');
  }

  const rawResponse = JSON.parse(toolCall.function.arguments);

  if (rawResponse.vote !== 'Approved' && rawResponse.vote !== 'Rejected') {
    throw new Error(`Invalid vote: "${rawResponse.vote}". Must be "Approved" or "Rejected"`);
  }

  if (rawResponse.reasoning.length > 10000) {
    throw new Error(`AI reasoning too long: ${rawResponse.reasoning.length} chars`);
  }

  // Fetch NEAR AI verification proof (non-blocking — vote still valid without it)
  let verificationProof: VerificationProof | undefined;
  const chatId = completion.id;
  if (chatId) {
    try {
      verificationProof = await fetchVerificationProof(chatId, model, apiKey);
      // Keep the exact signed payload and the wire bytes, so the signature can
      // be re-verified offline (the hashes alone cannot reproduce the text).
      (verificationProof as VerificationProof & { text?: string; request_body?: string; response_body?: string }).text =
        `${verificationProof.request_hash}:${verificationProof.response_hash}`;
      if (captured.requestBody) {
        (verificationProof as VerificationProof & { request_body?: string }).request_body = captured.requestBody;
      }
      if (captured.responseBody) {
        (verificationProof as VerificationProof & { response_body?: string }).response_body = captured.responseBody;
      }

      // Fetch model attestation to link signing_address to TEE hardware.
      // Scoped to the key that signed this chat, so the attestation binds to
      // THIS inference and not to some other serving key.
      if (verificationProof) {
        try {
          const attestation = await fetchModelAttestation(model, apiKey, verificationProof.signing_address);
          verificationProof.attestation = attestation;
        } catch (e) {
          console.warn('[ai-voter] Failed to fetch model attestation (non-critical):', e);
        }
      }
    } catch (e) {
      console.warn('[ai-voter] Failed to fetch verification proof (non-critical):', e);
    }
  }

  return {
    vote: rawResponse.vote,
    reasoning: rawResponse.reasoning,
    verificationProof,
  };
}

/**
 * Fetch NEAR AI model verification proof for a chat completion.
 * See: https://docs.near.ai/cloud/verification/chat
 *
 * The proof contains:
 * - text: the signed payload. For the `gateway` signature kind it is
 *   "request_hash:response_hash"; for `provider_tee` it is
 *   "{model_id}:{request_hash}:{response_hash}". Kept VERBATIM here — it is
 *   what the signature covers, so it must not be reconstructed later.
 * - signature: ECDSA signature verifiable with ethers.verifyMessage()
 * - signing_address: TEE public key unique to the model
 *
 * This proves which model was used WITHOUT exposing the actual content.
 */
async function fetchVerificationProof(
  chatId: string,
  model: string,
  apiKey: string,
): Promise<VerificationProof> {
  const url = `https://cloud-api.near.ai/v1/signature/${encodeURIComponent(chatId)}?model=${encodeURIComponent(model)}&signing_algo=ecdsa`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`Signature API returned ${res.status}: ${await res.text()}`);
  }

  const sig = await res.json() as {
    text: string;
    signature: string;
    signing_address: string;
    signing_algo: string;
    signature_kind?: string;
  };

  // "request_hash:response_hash" (gateway) or "{model}:{req}:{res}" (provider_tee).
  // The last two segments are the hashes in both shapes.
  const parts = sig.text.split(':');
  const requestHash = parts.length >= 3 ? parts[parts.length - 2] : parts[0];
  const responseHash = parts.length >= 3 ? parts[parts.length - 1] : parts[1];

  return {
    chat_id: chatId,
    model,
    request_hash: requestHash,
    response_hash: responseHash,
    signature: sig.signature,
    signing_address: sig.signing_address,
    signing_algo: sig.signing_algo,
    timestamp: Date.now(),
  } as VerificationProof;
}

/**
 * Fetch NEAR AI model attestation report.
 * Links the signing_address back to verified TEE hardware (Intel TDX / NVIDIA).
 *
 * GET /v1/attestation/report?model={model}&signing_algo=ecdsa&nonce={random_hex}
 *              &signing_address={the key that signed the chat}
 *
 * `signing_address` matters: without it the report may describe a different
 * serving key, and the attestation would not be bound to the signature.
 *
 * The response shape is:
 *   { gateway_attestation: { signing_address, intel_quote, report_data, request_nonce, ... },
 *     model_attestations: [ { provider, verified, tcb_status, gpu_verdict, gpu_evidence,
 *                             quote_b64, certificate_b64, nonce, ... } ] }
 */
async function fetchModelAttestation(
  model: string,
  apiKey: string,
  signingAddress: string,
): Promise<ModelAttestation> {
  const nonce = randomBytes(32).toString('hex');
  const url = `https://cloud-api.near.ai/v1/attestation/report?model=${encodeURIComponent(model)}&signing_algo=ecdsa&nonce=${nonce}&signing_address=${encodeURIComponent(signingAddress)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`Attestation API returned ${res.status}: ${await res.text()}`);
  }

  const report = await res.json() as {
    gateway_attestation?: { signing_address: string; intel_quote: string; report_data: string; request_nonce: string };
    model_attestations?: Array<{ provider?: string; verified?: boolean; tcb_status?: string; gpu_verdict?: string; quote_b64?: string; certificate_b64?: string; nonce?: string; gpu_evidence?: unknown }>;
  };

  const gw = report.gateway_attestation;
  const m = report.model_attestations?.[0];
  if (!gw?.intel_quote) {
    throw new Error('Attestation report carries no gateway_attestation.intel_quote');
  }

  return {
    signing_address: gw.signing_address ?? signingAddress,
    model,
    nonce: gw.request_nonce ?? nonce,
    attestation_report: gw.intel_quote,
    attestation_type: 'intel-tdx',
    // The model-side facts the API reports; kept so a buyer can see who served
    // the model and what the TCB/GPU verdicts were.
    provider: m?.provider ?? null,
    model_verified: m?.verified ?? null,
    tcb_status: m?.tcb_status ?? null,
    gpu_verdict: m?.gpu_verdict ?? null,
    gpu_evidence: m?.gpu_evidence ?? null,
    model_quote_b64: m?.quote_b64 ?? null,
    model_certificate_b64: m?.certificate_b64 ?? null,
    report_data: gw.report_data ?? null,
  } as ModelAttestation;
}
