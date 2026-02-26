import { auth } from '@/config/firebase'

const projectId = () => import.meta.env.VITE_FIREBASE_PROJECT_ID

async function getIdToken() {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.getIdToken()
}

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  return { stringValue: String(v) }
}

function fromValue(v) {
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('stringValue' in v) return v.stringValue
  if ('timestampValue' in v) return v.timestampValue
  return null
}

function fromFields(fields) {
  const obj = {}
  for (const [k, val] of Object.entries(fields)) obj[k] = fromValue(val)
  return obj
}

// Fetch activities for a contact, ordered by occurredAt descending
export const getActivities = async (contactId, maxResults = 100) => {
  const token = await getIdToken()
  const pid = projectId()
  const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/contacts/${contactId}:runQuery`

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'activities', allDescendants: false }],
        orderBy: [{ field: { fieldPath: 'occurredAt' }, direction: 'DESCENDING' }],
        limit: maxResults,
      },
    }),
  })

  if (!response.ok) {
    const e = await response.json().catch(() => ({}))
    throw new Error(e.error?.message || `Failed to fetch activities (${response.status})`)
  }

  const rows = await response.json()
  return rows
    .filter((r) => r.document)
    .map((r) => ({
      id: r.document.name.split('/').pop(),
      ...fromFields(r.document.fields || {}),
    }))
}

// Log a new activity under a contact
export const logActivity = async (contactId, data) => {
  const token = await getIdToken()
  const pid = projectId()
  const now = new Date().toISOString()
  const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/contacts/${contactId}/activities`

  const fields = {}
  for (const [k, v] of Object.entries(data)) fields[k] = toValue(v)
  fields.createdAt = { timestampValue: now }

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })

  if (!response.ok) {
    const e = await response.json().catch(() => ({}))
    throw new Error(e.error?.message || `Failed to log activity (${response.status})`)
  }

  const result = await response.json()
  return { id: result.name?.split('/').pop() }
}
