// @brot-os/notify — one-way push to your phone via Telegram.
//
// Runtime ESM build (kept in lockstep with index.ts) so the package works as a
// `file:` dependency inside Next standalone builds, which can't transpile a bare
// .ts on import. Edit index.ts and mirror the change here; index.d.ts is the
// type contract.
//
// The ONLY shared resource is the secret, read from the environment at runtime:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// On the NUC these are injected from the host's config/notify.env via systemd
// EnvironmentFile=. The code never hardcodes a token or a path.
//
// Server-side only (needs the bot token).

/**
 * Send a Telegram message. Resolves true on success, false on failure
 * (never throws) so a missed notification can't take down the caller.
 * @param {string} message
 * @param {{ title?: string, chatId?: string, token?: string }} [options]
 * @returns {Promise<boolean>}
 */
export async function notify(message, options = {}) {
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
