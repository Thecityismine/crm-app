import { db, auth } from '@/config/firebase'
import {
  collection, doc,
  getDoc, getDocs, query, where, orderBy, onSnapshot,
  limit,
} from 'firebase/firestore'
import { COLLECTIONS } from '@/config/constants'

const col = () => collection(db, COLLECTIONS.CONTACTS)

// Routes a write operation through the server-side Firestore REST proxy,
// bypassing the client SDK transport entirely.
async function firestoreWrite(operation, docId, data) {
  const idToken = await auth.currentUser.getIdToken()
  const res = await fetch('/api/firestore-write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operation,
      collection: COLLECTIONS.CONTACTS,
      docId: docId ?? null,
      data: data ?? null,
      idToken,
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Write failed')
  }
  return res.json()
}

export const getContacts = async () => {
  const snap = await getDocs(query(col(), orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const getContact = async (id) => {
  const snap = await getDoc(doc(db, COLLECTIONS.CONTACTS, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const createContact = (data) => firestoreWrite('create', null, data)

export const updateContact = (id, data) => firestoreWrite('update', id, data)

export const deleteContact = (id) => firestoreWrite('delete', id, null)

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

// Bulk import: splits into chunks and routes through the server-side proxy
export const batchImportContacts = async (contacts) => {
  const CHUNK = 10 // smaller batches since each is a separate HTTP call
  for (let i = 0; i < contacts.length; i += CHUNK) {
    const chunk = contacts.slice(i, i + CHUNK)
    await Promise.all(chunk.map((contact) => firestoreWrite('create', null, contact)))
  }
}
