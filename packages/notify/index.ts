// @claude-os/notify — one-way push to your phone via Telegram.
//
// Generic, configurable notification primitive. The ONLY shared resource is the
// secret, read from the environment at runtime:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
//
// On the NUC these are injected into each systemd --user service from
// ~/claude-os/config/notify.env (via EnvironmentFile=). On another host, set
// the two env vars however that host injects config — the code never hardcodes
// a token or a path.
//
// Server-side only (needs the bot token). Call from API routes / server actions
// / route handlers / workers — never from a client component.
//
//   import { notify } from "@claude-os/notify";
//   await notify("Job finished ✅");
//   await notify("Body line", { title: "Build" });

export type NotifyOptions = {
  /** Optional bold title prepended on its own line. */
  title?: string;
  /** Override the chat id (defaults to TELEGRAM_CHAT_ID). */
  chatId?: string;
  /** Override the bot token (defaults to TELEGRAM_BOT_TOKEN). */
  token?: string;
};

/**
 * Send a Telegram message. Resolves true on success, false on failure
 * (never throws) so a missed notification can't take down the caller.
 */
export async function notify(
  message: string,
  options: NotifyOptions = {},
): Promise<boolean> {
  const token = options.token ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId ?? process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error(
      "[notify] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set; skipping notification",
    );
    return false;
  }

  const text = options.title ? `*${options.title}*\n${message}` : message;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
        // Don't let a slow Telegram call hang a request forever.
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) {
      console.error(
        `[notify] Telegram API returned ${res.status}: ${await res.text()}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify] request failed:", err);
    return false;
  }
}
