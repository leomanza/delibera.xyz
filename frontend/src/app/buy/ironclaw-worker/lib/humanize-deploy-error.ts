import type { IronClawProvisionStatus } from "../hooks/useIronClawProvisionJob";

/**
 * Maps the raw error text from the protocol-api deploy pipeline to a
 * user-friendly form: a short title, a 1-2 sentence body, and a flag for
 * whether a droplet was created (so the UI can pick the right reassurance:
 * "no charges" vs "double-check your DO console").
 *
 * The raw text is preserved by the caller and rendered in a collapsible
 * `<details>` block — engineers can still grep for it; users see the
 * humanized version first.
 *
 * Pattern matches are case-insensitive substring matches. Order matters —
 * more specific patterns come first.
 */
export interface HumanizedError {
  title: string;
  body: string;
  attemptedStep?: IronClawProvisionStatus;
  /** True if a droplet was created and may need verification in the DO console. */
  dropletCreated: boolean;
}

export function humanizeDeployError(
  raw: string | undefined,
  currentStatus?: IronClawProvisionStatus,
): HumanizedError {
  const r = (raw ?? "").toLowerCase();

  if (r.includes("createdroplet failed") && r.includes("401")) {
    return {
      title: "DigitalOcean rejected your API token",
      body: "Check that the token has read+write scope and hasn't expired. No droplet was created and your DO account was not charged.",
      attemptedStep: "creating_droplet",
      dropletCreated: false,
    };
  }

  if (r.includes("createdroplet failed") && r.includes("422")) {
    return {
      title: "DigitalOcean refused the droplet request",
      body: "Usually a quota issue, an invalid region, or a billing problem on the DO account. Check your DO console and retry. No droplet was created.",
      attemptedStep: "creating_droplet",
      dropletCreated: false,
    };
  }

  if (r.includes("createdroplet failed")) {
    return {
      title: "DigitalOcean rejected the droplet request",
      body: "The DO API returned an error. Check the raw error below and your DO console. No droplet was created.",
      attemptedStep: "creating_droplet",
      dropletCreated: false,
    };
  }

  if (r.includes("ip timeout") || (r.includes("waitfordropletip") && r.includes("timeout"))) {
    return {
      title: "Droplet didn't get a public IP",
      body: "DigitalOcean created the droplet but didn't assign a public IP within 5 minutes. The droplet has been destroyed automatically — you have NOT been charged for a full month.",
      attemptedStep: "waiting_for_ip",
      dropletCreated: true,
    };
  }

  if (r.includes("ssh port") && r.includes("not reachable")) {
    return {
      title: "Server didn't become reachable over SSH",
      body: "Cloud-init may have failed. The droplet has been destroyed automatically. Retry, or contact support if this persists.",
      attemptedStep: "waiting_for_ssh",
      dropletCreated: true,
    };
  }

  if (r.includes("[ssh-configurator]") && r.includes("exited with code")) {
    return {
      title: "Configuration failed on the droplet",
      body: "A remote command failed during agent setup. The droplet has been destroyed automatically. Retry; if the same step fails repeatedly, save the raw error for support.",
      attemptedStep: "configuring_agent",
      dropletCreated: true,
    };
  }

  if (r.includes("near ai") || r.includes("nearai_api_key")) {
    return {
      title: "NEAR AI key rejected",
      body: "Check the key on your NEAR AI account page. The droplet has been destroyed.",
      attemptedStep: "configuring_agent",
      dropletCreated: true,
    };
  }

  return {
    title: "Deployment failed",
    body: raw
      ? `Unexpected error during ${currentStatus ?? "deployment"}. The full error is shown below — share it with support if you need help.`
      : "Unexpected error. Try again, or share the error text below with support.",
    attemptedStep: currentStatus,
    // Conservative default: unknown failure could be after droplet creation.
    // Surface the warning so users can sanity-check their DO console.
    dropletCreated: false,
  };
}
