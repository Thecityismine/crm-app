import crypto from 'crypto'

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

async function fsQuery(projectId, token, collection, filters = []) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: filters.length === 1 ? filters[0] : filters.length > 1 ? {
        compositeFilter: { op: 'AND', filters },
      } : undefined,
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const rows = await res.json()
  return rows
    .filter((r) => r.document)
    .map((r) => ({ id: r.document.name.split('/').pop(), ...fromFields(r.document.fields) }))
}

// ── Business logic ────────────────────────────────────────────────────────────

function todayLocal() {
  // Returns YYYY-MM-DD in Central Time (UTC-5/6). We use UTC-6 as safe default.
  const d = new Date(Date.now() - 6 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}

function daysBetween(isoA, isoB) {
  return Math.round((new Date(isoA) - new Date(isoB)) / 86400000)
}

function findBirthdays(contacts, today, windowDays = 3) {
  const [, todayMM, todayDD] = today.split('-').map(Number)
  return contacts.filter((c) => {
    if (!c.birthday) return false
    const parts = c.birthday.split('-')
    if (parts.length < 3) return false
    const mm = Number(parts[1])
    const dd = Number(parts[2])
    // Check within next windowDays (wrap around year-end)
    for (let i = 0; i <= windowDays; i++) {
      const d = new Date(new Date().setHours(0,0,0,0))
      d.setDate(d.getDate() + i)
      if (d.getMonth() + 1 === mm && d.getDate() === dd) return true
    }
    return false
  })
}

function findDueTasks(tasks, today) {
  return tasks.filter((t) => {
    if (t.status === 'completed' || t.status === 'cancelled') return false
    if (!t.dueDate) return false
    return t.dueDate <= today
  })
}

function findNeedsAttention(contacts, today) {
  return contacts.filter((c) => {
    if (!c.lastCommunication) return false
    const daysSince = daysBetween(today, c.lastCommunication.slice(0, 10))
    if (c.interval) {
      const INTERVAL_DAYS = { '30 Days': 30, '60 Days': 60, '90 Days': 90, '6 Months': 180, '1 Year': 365 }
      const intervalDays = INTERVAL_DAYS[c.interval]
      if (intervalDays) return daysSince > intervalDays
    }
    return daysSince > 30
  })
}

function buildMessage(today, birthdays, dueTasks, attentionContacts) {
  const lines = [`📋 CRM Daily Digest — ${today}`]

  if (birthdays.length) {
    lines.push(`\n🎂 Birthdays (next 3 days):`)
    birthdays.forEach((c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
      lines.push(`  • ${name}${c.birthday ? ' (' + c.birthday.slice(5) + ')' : ''}`)
    })
  }

  if (dueTasks.length) {
    lines.push(`\n✅ Tasks Due / Overdue (${dueTasks.length}):`)
    dueTasks.slice(0, 5).forEach((t) => {
      const flag = t.dueDate < today ? '🔴' : '🟡'
      lines.push(`  ${flag} ${t.title}${t.contactName ? ' — ' + t.contactName : ''}`)
    })
    if (dueTasks.length > 5) lines.push(`  … and ${dueTasks.length - 5} more`)
  }

  if (attentionContacts.length) {
    lines.push(`\n💬 Contacts Needing Attention (${attentionContacts.length}):`)
    attentionContacts.slice(0, 5).forEach((c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
      const daysSince = daysBetween(today, c.lastCommunication.slice(0, 10))
      lines.push(`  • ${name} (${daysSince}d ago)`)
    })
    if (attentionContacts.length > 5) lines.push(`  … and ${attentionContacts.length - 5} more`)
  }

  if (!birthdays.length && !dueTasks.length && !attentionContacts.length) {
    lines.push('\n✨ All clear — nothing urgent today!')
  }

  return lines.join('\n')
}

// ── Twilio send ───────────────────────────────────────────────────────────────

async function sendSMS(accountSid, authToken, from, to, body) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }),
  })
  const data = await res.json()
  if (data.error_code) throw new Error(`Twilio error ${data.error_code}: ${data.message}`)
  return data.sid
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Verify cron secret (Vercel sends it in Authorization header)
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.authorization || ''
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const projectId = (process.env.VITE_FIREBASE_PROJECT_ID || '').trim()
  const twilioSid   = process.env.TWILIO_ACCOUNT_SID
  const twilioAuth  = process.env.TWILIO_AUTH_TOKEN
  const twilioFrom  = process.env.TWILIO_FROM_NUMBER
  const notifyPhone = process.env.NOTIFY_PHONE
  const saRaw       = process.env.FIREBASE_SERVICE_ACCOUNT

  const missing = ['VITE_FIREBASE_PROJECT_ID', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN',
    'TWILIO_FROM_NUMBER', 'NOTIFY_PHONE', 'FIREBASE_SERVICE_ACCOUNT']
    .filter((k) => !process.env[k])
  if (missing.length) return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` })

  try {
    const serviceAccount = JSON.parse(saRaw)
    const token = await getGoogleAccessToken(serviceAccount)
    const today = todayLocal()

    const [contacts, tasks] = await Promise.all([
      fsQuery(projectId, token, 'contacts'),
      fsQuery(projectId, token, 'tasks'),
    ])

    const birthdays        = findBirthdays(contacts, today)
    const dueTasks         = findDueTasks(tasks, today)
    const attentionContacts = findNeedsAttention(contacts, today)

    const hasAnything = birthdays.length || dueTasks.length || attentionContacts.length
    if (!hasAnything) {
      return res.status(200).json({ sent: false, reason: 'Nothing to report today' })
    }

    const message = buildMessage(today, birthdays, dueTasks, attentionContacts)
    const sid = await sendSMS(twilioSid, twilioAuth, twilioFrom, notifyPhone, message)

    return res.status(200).json({
      sent: true,
      sid,
      birthdays: birthdays.length,
      tasks: dueTasks.length,
      attention: attentionContacts.length,
    })
  } catch (err) {
    console.error('daily-digest error:', err)
    return res.status(500).json({ error: err.message })
  }
}
