import { db, auth } from '@/config/firebase'
import {
  collection, query, orderBy, onSnapshot,
} from 'firebase/firestore'
import { COLLECTIONS } from '@/config/constants'

// ---------------------------------------------------------------------------
// Firestore REST API helpers
// All write ops and on-demand reads use the REST API via the user's Firebase
// ID token. The onSnapshot listener (real-time updates) still uses the client
// SDK since it works well without the force-long-polling flag.
// ---------------------------------------------------------------------------

const projectId = () => import.meta.env.VITE_FIREBASE_PROJECT_ID
const colUrl = () =>
  `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/${COLLECTIONS.CONTACTS}`

async function getIdToken() {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.getIdToken()
}

// Convert JS value → Firestore REST typed value
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  return { stringValue: String(v) }
}

// Convert Firestore REST typed value → JS value
function fromValue(v) {
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('stringValue' in v) return v.stringValue
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue)
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {})
  return null
}

function toFields(obj) {
  const fields = {}
  for (const [k, val] of Object.entries(obj)) fields[k] = toValue(val)
  return fields
}

function fromFields(fields) {
  const obj = {}
  for (const [k, val] of Object.entries(fields)) obj[k] = fromValue(val)
  return obj
}

// ---------------------------------------------------------------------------
// REST write helper
// ---------------------------------------------------------------------------

async function restWrite(operation, docId, data) {
  const token = await getIdToken()
  const now = new Date().toISOString()
  const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  let response

  if (operation === 'create') {
    const fields = toFields({ ...data })
    fields.createdAt = { timestampValue: now }
    fields.updatedAt = { timestampValue: now }
    response = await fetch(colUrl(), { method: 'POST', headers: hdrs, body: JSON.stringify({ fields }) })

  } else if (operation === 'update') {
    const fields = toFields({ ...data })
    fields.updatedAt = { timestampValue: now }
    const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
    response = await fetch(`${colUrl()}/${docId}?${mask}`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ fields }) })

  } else if (operation === 'delete') {
    response = await fetch(`${colUrl()}/${docId}`, { method: 'DELETE', headers: hdrs })
    if (!response.ok) {
      const e = await response.json().catch(() => ({}))
      throw new Error(e.error?.message || `Delete failed (${response.status})`)
    }
    return {}
  }

  if (!response.ok) {
    const e = await response.json().catch(() => ({}))
    throw new Error(e.error?.message || `Firestore ${operation} failed (${response.status})`)
  }
  const result = await response.json()
  return { id: result.name?.split('/').pop() }
}

// ---------------------------------------------------------------------------
// REST read helper — used for on-demand fetches & post-write refresh
// ---------------------------------------------------------------------------

async function restQuery() {
  const token = await getIdToken()
  const projectID = projectId()
  const url = `https://firestore.googleapis.com/v1/projects/${projectID}/databases/(default)/documents:runQuery`

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: COLLECTIONS.CONTACTS }],
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: 1000,
      },
    }),
  })

  if (!response.ok) {
    const e = await response.json().catch(() => ({}))
    throw new Error(e.error?.message || `Query failed (${response.status})`)
  }

  const rows = await response.json()
  return rows
    .filter((r) => r.document)
    .map((r) => ({
      id: r.document.name.split('/').pop(),
      ...fromFields(r.document.fields || {}),
    }))
}

async function restGetDoc(docId) {
  const token = await getIdToken()
  const response = await fetch(`${colUrl()}/${docId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (response.status === 404) return null
  if (!response.ok) {
    const e = await response.json().catch(() => ({}))
    throw new Error(e.error?.message || `Get failed (${response.status})`)
  }
  const doc = await response.json()
  return { id: doc.name.split('/').pop(), ...fromFields(doc.fields || {}) }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const col = () => collection(db, COLLECTIONS.CONTACTS)

export const getContacts = () => restQuery()
export const getContact = (id) => restGetDoc(id)
export const createContact = (data) => restWrite('create', null, data)
export const updateContact = (id, data) => restWrite('update', id, data)
export const deleteContact = (id) => restWrite('delete', id, null)

// Real-time listener (client SDK) — fast without force-long-polling
export const subscribeToContacts = (callback) =>
  onSnapshot(query(col(), orderBy('createdAt', 'desc')), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

export const batchImportContacts = async (contacts) => {
  const CHUNK = 10
  for (let i = 0; i < contacts.length; i += CHUNK) {
    const chunk = contacts.slice(i, i + CHUNK)
    await Promise.all(chunk.map((c) => restWrite('create', null, c)))
  }
}
