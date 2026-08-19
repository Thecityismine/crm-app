import crypto from 'crypto'
import { sendTelegram } from './_lib/telegram.js'
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

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Vercel Cron sends the CRON_SECRET as a bearer token. The same header works
  // for a manual trigger, which is how you test without waiting for the cron.
  const secret = process.env.CRON_SECRET
  if (secret && (req.headers.authorization || '') !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const required = ['VITE_FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT',
    'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` })
  }

  const projectId = (process.env.VITE_FIREBASE_PROJECT_ID || '').trim()

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    const token = await getGoogleAccessToken(serviceAccount)

    const now = new Date()
    const today = todayInZone(now)
    const isMonday = weekdayInZone(now) === 'Mon'

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
    return res.status(500).json({ error: err.message })
  }
}
