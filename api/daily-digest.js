import crypto from 'crypto'
import { sendTelegram, escapeHtml } from './_lib/telegram.js'
import {
  findBirthdays, findAnniversaries, findFollowUps, findDueTasks,
  findNeedsAttention, buildDigest,
} from './_lib/alerts.js'

const TIME_ZONE = 'America/New_York'

// ── Google Service Account JWT auth ──────────────────────────────────────────

function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getGoogleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  const sigInput = `${header}.${payload}`
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(sigInput)
  const sig = sign.sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${sigInput}.${sig}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`OAuth failed: ${JSON.stringify(data)}`)
  return data.access_token
}

// ── Firestore helpers ─────────────────────────────────────────────────────────

function fromValue(v) {
  if (!v) return null
  if ('stringValue'    in v) return v.stringValue
  if ('integerValue'   in v) return Number(v.integerValue)
  if ('doubleValue'    in v) return v.doubleValue
  if ('booleanValue'   in v) return v.booleanValue
  if ('timestampValue' in v) return v.timestampValue
  if ('nullValue'      in v) return null
  if ('arrayValue'     in v) return (v.arrayValue.values || []).map(fromValue)
  if ('mapValue'       in v) return fromFields(v.mapValue.fields || {})
  return null
}

function fromFields(fields) {
  const obj = {}
  for (const [k, v] of Object.entries(fields || {})) obj[k] = fromValue(v)
  return obj
}

async function fsQuery(projectId, token, collection) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }] } }),
  })
  if (!res.ok) throw new Error(`Firestore ${collection} query failed: ${res.status}`)
  const rows = await res.json()
  return rows
    .filter((r) => r.document)
    .map((r) => ({ id: r.document.name.split('/').pop(), ...fromFields(r.document.fields) }))
}

// ── Clock ─────────────────────────────────────────────────────────────────────

// The cron fires at a fixed UTC hour but the digest is scoped to the user's
// Eastern day. Intl resolves EST vs EDT from the date itself, so this stays
// correct across both DST transitions without a hardcoded offset.
export function todayInZone(now = new Date(), timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function weekdayInZone(now = new Date(), timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now)
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Vercel Cron sends the CRON_SECRET as a bearer token; the same header works
 * for a manual trigger, which is how you test without waiting for the cron.
 *
 * Fails closed. This used to be `if (secret && ...)`, which meant that if
 * CRON_SECRET were ever removed or renamed the endpoint quietly became public —
 * and this endpoint sends Telegram messages and reads the entire contact book.
 * A missing secret is a reason to refuse, not to wave everyone through.
 */
export function authorized(req, secret = process.env.CRON_SECRET) {
  if (!secret) return false
  const provided = Buffer.from(String(req?.headers?.authorization || ''))
  const expected = Buffer.from(`Bearer ${secret}`)
  // timingSafeEqual throws on a length mismatch, so check that first.
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected)
}

// ── Failure reporting ─────────────────────────────────────────────────────────

/**
 * Say so when the digest breaks.
 *
 * Without this a crash and a quiet day are the same thing from the user's
 * phone: nothing arrives either way. Best-effort by design — it swallows its
 * own errors so a failing notifier can never mask the failure it is reporting.
 */
async function reportFailure(stage, detail) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false
  try {
    await sendTelegram(token, chatId,
`⚠️ <b>CRM digest failed</b>
<i>${escapeHtml(stage)}</i>

${escapeHtml(detail)}

<i>No digest today — this is a failure, not a quiet day.</i>`)
    return true
  } catch {
    return false
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (!process.env.CRON_SECRET) {
    // Deliberately not reported to Telegram: this branch is reachable by an
    // unauthenticated caller, so alerting here would hand anyone a way to spam
    // the chat from a public endpoint.
    return res.status(500).json({ error: 'CRON_SECRET is not configured' })
  }
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const required = ['VITE_FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT',
    'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    // Past the auth gate, so this can only be the cron or the owner.
    await reportFailure('configuration', `Missing env vars: ${missing.join(', ')}`)
    return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` })
  }

  const projectId = (process.env.VITE_FIREBASE_PROJECT_ID || '').trim()

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    const token = await getGoogleAccessToken(serviceAccount)

    const now = new Date()
    // ?date=YYYY-MM-DD runs the digest as though it were that day, for checking
    // what an upcoming morning will look like. Auth-gated like everything else.
    const override = /^\d{4}-\d{2}-\d{2}$/.test(req.query?.date || '') ? req.query.date : null
    const today = override || todayInZone(now)
    const isMonday = override
      ? new Date(today + 'T12:00:00Z').getUTCDay() === 1
      : weekdayInZone(now) === 'Mon'

    const [contacts, tasks] = await Promise.all([
      fsQuery(projectId, token, 'contacts'),
      fsQuery(projectId, token, 'tasks'),
    ])

    const parts = {
      birthdays:     findBirthdays(contacts, today),
      anniversaries: findAnniversaries(contacts, today),
      followUps:     findFollowUps(contacts, today),
      dueTasks:      findDueTasks(tasks, today),
      // Standing backlog rather than a dated event — weekly, not daily.
      needsAttention: isMonday ? findNeedsAttention(contacts, today) : [],
    }

    const counts = Object.fromEntries(
      Object.entries(parts).map(([k, v]) => [k, v.length]))

    // How much was read, so a silent morning is distinguishable from a broken
    // query. All-zero counts against zero contacts is a fetch problem; all-zero
    // against 400 contacts is just a quiet day.
    const scanned = {
      contacts: contacts.length,
      tasks: tasks.length,
      withBirthdate: contacts.filter((c) => c.birthdate || c.nextBirthday).length,
      withAnniversary: contacts.filter((c) => c.weddingAnniversary).length,
      withFollowUp: contacts.filter((c) => c.nextFollowUp).length,
      // Contacts on an actual recurrence — the only ones that can go overdue.
      withInterval: contacts.filter((c) => c.interval).length,
      scheduled: contacts.filter((c) => c.interval || c.nextFollowUp).length,
    }

    const message = buildDigest(today, parts)
    if (!message) {
      return res.status(200).json({ sent: false, today, reason: 'Nothing to report', counts, scanned })
    }

    // Dry run: ?preview=1 returns the message without sending it.
    if (req.query?.preview) {
      return res.status(200).json({ sent: false, today, preview: message, counts, scanned })
    }

    const messageId = await sendTelegram(
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.TELEGRAM_CHAT_ID,
      message,
    )

    return res.status(200).json({ sent: true, today, messageId, counts, scanned })
  } catch (err) {
    console.error('daily-digest error:', err)
    // A preview is run by someone watching the response, so it needs no alert.
    const notified = req.query?.preview ? false : await reportFailure('while building the digest', err.message)
    return res.status(500).json({ error: err.message, notified })
  }
}
