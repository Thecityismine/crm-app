// Telegram transport. No dependencies — the Bot API is one HTTP call.
//
// Uses `fetch` rather than `https.request`: the request body must be UTF-8, and
// the digest is emoji-heavy. Hand-rolling the request buffer got us a literal
// "Bad Request: text must be encoded in UTF-8" from Telegram; fetch + a
// JSON.stringify'd body with an explicit charset gets the encoding right.
//
// parse_mode is HTML, not Markdown. Contact names are user data and routinely
// contain `_` and `*` (and Notion imports carry stray brackets) — legacy
// Markdown has no escape hatch for those and Telegram rejects the whole
// message with a 400. HTML needs only three characters escaped.

const TELEGRAM_LIMIT = 4096

/** Escape user-supplied text for parse_mode: 'HTML'. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Trim to Telegram's cap on a line boundary so no HTML tag is cut in half. */
function clamp(text) {
  if (text.length <= TELEGRAM_LIMIT) return text
  const suffix = '\n\n<i>…truncated</i>'
  const cut = text.slice(0, TELEGRAM_LIMIT - suffix.length)
  return cut.slice(0, cut.lastIndexOf('\n')) + suffix
}

/**
 * Send one message. Returns the Telegram message_id.
 * Both secrets are trimmed — a trailing newline in a stored env var is the
 * classic cause of a mystifying 404 from the Bot API.
 */
export async function sendTelegram(token, chatId, message) {
  const res = await fetch(`https://api.telegram.org/bot${String(token).trim()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      chat_id: String(chatId).trim(),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      text: clamp(message),
    }),
  })

  const data = await res.json()
  if (data.ok !== true) {
    throw new Error(`Telegram send failed (${data.error_code}): ${data.description}`)
  }
  return data.result.message_id
}
