import type { IronClawJobState } from "../hooks/useIronClawProvisionJob";

/**
 * A serializable recovery payload — everything the user needs to reconfigure,
 * migrate, or debug their worker. The webhook secret is the only field they
 * literally cannot recover any other way once they close this tab.
 */
export interface RecoveryFile {
  schema: "delibera-ironclaw-recovery-v1";
  generatedAt: string;
  workerDid: string;
  workerName?: string;
  nearAccount: string;
  coordinatorDid: string;
  dropletIp: string;
  webhookUrl: string;
  webhookSecret: string;
  cvmId: string;
}

export interface BuildResult {
  filename: string;
  json: string;
}

/**
 * Build a recovery-file download payload from a completed job's state.
 *
 * Returns null if any REQUIRED field is missing — callers should hide the
 * download button rather than offer a partial file (the whole point of the
 * file is the webhook secret + identity).
 */
export function buildRecoveryFile(job: IronClawJobState | null): BuildResult | null {
  if (!job) return null;
  if (!job.workerDid || !job.webhookSecret || !job.phalaEndpoint || !job.cvmId || !job.dropletIp) {
    return null;
  }
  const payload: RecoveryFile = {
    schema: "delibera-ironclaw-recovery-v1",
    generatedAt: new Date().toISOString(),
    workerDid: job.workerDid,
    workerName: job.displayName,
    nearAccount: job.nearAccount ?? "",
    coordinatorDid: job.coordinatorDid ?? "",
    dropletIp: job.dropletIp,
    webhookUrl: job.phalaEndpoint,
    webhookSecret: job.webhookSecret,
    cvmId: job.cvmId,
  };
  const safeName = (job.displayName || "worker")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 32);
  const date = new Date().toISOString().slice(0, 10);
  return {
    filename: `delibera-recovery-${safeName}-${date}.json`,
    json: JSON.stringify(payload, null, 2),
  };
}

/**
 * Trigger a browser download of a JSON file. Browser-only — callers must be a
 * client component. We revoke the object URL synchronously after click() to
 * avoid leaking it for the page's lifetime.
 */
export function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
