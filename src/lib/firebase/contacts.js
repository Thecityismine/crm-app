import { db, auth } from '@/config/firebase'
import {
  collection, doc,
  getDoc, getDocs, query, where, orderBy, onSnapshot,
  limit,
} from 'firebase/firestore'
import { COLLECTIONS } from '@/config/constants'

const col = () => collection(db, COLLECTIONS.CONTACTS)

// ---------------------------------------------------------------------------
// Firestore REST API helpers — bypasses the client SDK for all write ops.
// The client SDK's addDoc/updateDoc/deleteDoc were timing out; the REST API
// uses plain HTTP fetch which works reliably from the browser.
// ---------------------------------------------------------------------------

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return { doubleValue: value }
  if (typeof value === 'string') return { stringValue: value }
  return { stringValue: String(value) }
}

function toFirestoreFields(obj) {
  const fields = {}
  for (const [key, value] of Object.entries(obj)) {
    fields[key] = toFirestoreValue(value)
  }
  return fields
}

async function restWrite(operation, docId, data) {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')

  const idToken = await user.getIdToken()
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${COLLECTIONS.CONTACTS}`
  const now = new Date().toISOString()
  const headers = {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  }

  let response

  if (operation === 'create') {
    const fields = toFirestoreFields({ ...data })
    fields.createdAt = { timestampValue: now }
    fields.updatedAt = { timestampValue: now }
    response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fields }),
    })

  } else if (operation === 'update') {
    const fields = toFirestoreFields({ ...data })
    fields.updatedAt = { timestampValue: now }
    const mask = Object.keys(fields)
      .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
      .join('&')
    response = await fetch(`${baseUrl}/${docId}?${mask}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields }),
    })

  } else if (operation === 'delete') {
    response = await fetch(`${baseUrl}/${docId}`, { method: 'DELETE', headers })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error?.message || `Delete failed (${response.status})`)
    }
    return {}
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `Firestore ${operation} failed (${response.status})`)
  }

  const result = await response.json()
  return { id: result.name?.split('/').pop() }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const getContacts = async () => {
  const snap = await getDocs(query(col(), orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const getContact = async (id) => {
  const snap = await getDoc(doc(db, COLLECTIONS.CONTACTS, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const createContact = (data) => restWrite('create', null, data)
export const updateContact = (id, data) => restWrite('update', id, data)
export const deleteContact = (id) => restWrite('delete', id, null)

export const subscribeToContacts = (callback) =>
  onSnapshot(query(col(), orderBy('createdAt', 'desc')), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

export const getColdContacts = async () => {
  const snap = await getDocs(
    query(col(), where('healthStatus', 'in', ['cold', 'at_risk']), limit(20))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const batchImportContacts = async (contacts) => {
  const CHUNK = 10
  for (let i = 0; i < contacts.length; i += CHUNK) {
    const chunk = contacts.slice(i, i + CHUNK)
    await Promise.all(chunk.map((c) => restWrite('create', null, c)))
  }
}
