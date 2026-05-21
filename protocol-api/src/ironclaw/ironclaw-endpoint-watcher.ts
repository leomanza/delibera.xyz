import { probeWebhook } from './ironclaw-client';

export async function watchForIronClawWebhook(
  webhookUrl: string,
  webhookSecret: string,
  onReady: (url: string) => void,
  maxMinutes = 15,
): Promise<void> {
  const attempts = maxMinutes * 4; // poll every 15s
  for (let i = 0; i < attempts; i++) {
    const ok = await probeWebhook(webhookUrl, webhookSecret);
    if (ok) {
      console.log(`[ironclaw] Webhook ready at ${webhookUrl} (attempt ${i + 1}/${attempts})`);
      onReady(webhookUrl);
      return;
    }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 15_000));
  }
  console.warn(`[ironclaw] Webhook not ready after ${maxMinutes}min — continuing anyway`);
}
