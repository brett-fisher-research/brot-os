export type NotifyOptions = {
  /** Optional bold title prepended on its own line. */
  title?: string;
  /** Override the chat id (defaults to TELEGRAM_CHAT_ID). */
  chatId?: string;
  /** Override the bot token (defaults to TELEGRAM_BOT_TOKEN). */
  token?: string;
};

/**
 * Send a one-way Telegram push. Resolves true on success, false on failure
 * (never throws). Reads TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID from the
 * environment unless overridden via options.
 */
export declare function notify(
  message: string,
  options?: NotifyOptions,
): Promise<boolean>;
