import { auth } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'

const projectId = () => import.meta.env.VITE_FIREBASE_PROJECT_ID
const colUrl = () =>
  `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/${COLLECTIONS.COMPANIES}`

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

function toFields(obj) {
  const fields = {}
  for (const [k, val] of Object.entries(obj)) {
    if (val !== undefined) fields[k] = toValue(val)
  }
  return fields
}

function fromFields(fields) {
  const obj = {}
  for (const [k, val] of Object.entries(fields)) obj[k] = fromValue(val)
  return obj
}

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

export const getCompanies = async () => {
  const token = await getIdToken()
  const pid = projectId()
  const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents:runQuery`

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: COLLECTIONS.COMPANIES }],
        orderBy: [{ field: { fieldPath: 'name' }, direction: 'ASCENDING' }],
        limit: 500,
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

export const getCompany = async (id) => {
  const token = await getIdToken()
  const response = await fetch(`${colUrl()}/${id}`, {
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

export const createCompany = (data) => restWrite('create', null, data)
export const updateCompany = (id, data) => restWrite('update', id, data)
export const deleteCompany = (id) => restWrite('delete', id, null)
