"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://protocol-api-production.up.railway.app";

const STORAGE_KEY = "delibera_ironclaw_provision_job_id";
const DRAFT_KEY = "delibera_ironclaw_provision_draft";

/**
 * The non-secret form fields preserved across Try-again so a typo doesn't cost
 * the user a full retype. API tokens (DO + NEAR AI) are NEVER stored — they're
 * cleared on every reset.
 */
export interface ConfigDraft {
  displayName?: string;
  coordinatorDid?: string;
  doRegion?: string;
}

export type IronClawProvisionStatus =
  | "generating_identity"
  | "creating_space"
  | "creating_droplet"
  | "waiting_for_ip"
  | "waiting_for_ssh"
  | "waiting_for_cloud_init"
  | "configuring_agent"
  | "starting_agent"
  | "waiting_for_webhook"
  | "awaiting_near_signature"
  | "registering"
  | "complete"
  | "failed";

export interface IronClawJobState {
  jobId: string;
  status: IronClawProvisionStatus;
  step: string;
  workerDid?: string;
  storachaPrivateKey?: string;
  phalaEndpoint?: string; // holds webhook URL (reuses phalaEndpoint field name from API)
  cvmId?: string;
  dropletIp?: string;
  webhookSecret?: string;
  dashboardUrl?: string;
  coordinatorDid?: string;
  displayName?: string;
  nearAccount?: string;
  error?: string;
  /** Last non-failed status before failure — used by ProgressScreen to place the ✗ marker. */
  attemptedStep?: IronClawProvisionStatus;
  /** Hash of the register_worker transaction once the user has signed. */
  registrationTxHash?: string;
}

const POLL_INTERVAL = 5000;

export function useIronClawProvisionJob() {
  const [job, setJob] = useState<IronClawJobState | null>(null);
  const [loading, setLoading] = useState(false);
  // Non-secret form fields preserved across reset/reload so a typo doesn't cost a retype.
  const [draft, setDraftState] = useState<ConfigDraft>({});
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Restore draft on mount (survives a reload AND a Try-again click).
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraftState(JSON.parse(raw));
    } catch { /* ignore malformed draft */ }

    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      pollStatus(savedId).then((data) => {
        if (data && data.status !== "failed") {
          setJob(data);
          if (data.status !== "complete" && data.status !== "awaiting_near_signature") {
            startPolling(savedId);
          }
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDraft = useCallback((patch: ConfigDraft) => {
    setDraftState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      } catch { /* ignore quota errors */ }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function pollStatus(jobId: string): Promise<IronClawJobState | null> {
    try {
      const res = await fetch(`${API_URL}/api/provision/status/${jobId}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function startPolling(jobId: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      const data = await pollStatus(jobId);
      if (!data) return;
      setJob((prev) => {
        // When server reports failed, freeze the previous progress status as
        // `attemptedStep` so the Progress screen knows where to put the ✗.
        // Don't overwrite an existing attemptedStep on subsequent polls.
        if (
          data.status === "failed" &&
          prev &&
          prev.status !== "failed" &&
          prev.status !== "complete"
        ) {
          return { ...data, attemptedStep: prev.status };
        }
        return data;
      });
      if (
        data.status === "complete" ||
        data.status === "failed" ||
        data.status === "awaiting_near_signature"
      ) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }, POLL_INTERVAL);
  }

  const startProvision = useCallback(
    async (params: {
      coordinatorDid: string;
      displayName: string;
      nearAccount: string;
      doApiToken: string;
      doRegion: string;
      nearAiApiKey: string;
    }) => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/provision/ironclaw-worker`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Provision request failed");

        const jobId = data.jobId as string;
        localStorage.setItem(STORAGE_KEY, jobId);

        // Capture non-secret config into the draft so Try-again preserves it.
        setDraft({
          displayName: params.displayName,
          coordinatorDid: params.coordinatorDid,
          doRegion: params.doRegion,
        });

        setJob({
          jobId,
          status: "generating_identity",
          step: "Generating worker identity",
          coordinatorDid: params.coordinatorDid,
          displayName: params.displayName,
          nearAccount: params.nearAccount,
        });

        startPolling(jobId);
        return jobId;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setJob({
          jobId: "",
          status: "failed",
          step: "Failed to start",
          error: msg,
          attemptedStep: "generating_identity",
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const completeRegistration = useCallback(
    async (txHash?: string) => {
      if (!job?.jobId) return;
      try {
        await fetch(`${API_URL}/api/provision/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.jobId, txHash }),
        });
      } catch (err) {
        console.error("Registration API error:", err);
      }
      setJob((prev) =>
        prev
          ? {
              ...prev,
              status: "complete",
              step: "Worker active",
              // Persist the tx hash so SuccessScreen can link to the explorer.
              registrationTxHash: txHash ?? prev.registrationTxHash,
            }
          : prev,
      );
      localStorage.removeItem(STORAGE_KEY);
    },
    [job?.jobId],
  );

  const reset = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = null;
    setJob(null);
    localStorage.removeItem(STORAGE_KEY);
    // DO NOT clear the draft. The whole point of Try-again is to retry with the
    // same non-secret config; only API tokens must be re-entered.
  }, []);

  /** Full reset including the draft — used by "Deploy another" on the SuccessScreen. */
  const resetIncludingDraft = useCallback(() => {
    reset();
    setDraftState({});
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }, [reset]);

  return { job, loading, draft, setDraft, startProvision, completeRegistration, reset, resetIncludingDraft };
}
