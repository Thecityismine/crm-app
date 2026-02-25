import { db } from '@/config/firebase'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, onSnapshot,
  serverTimestamp, limit, writeBatch
} from 'firebase/firestore'
import { COLLECTIONS } from '@/config/constants'

const col = () => collection(db, COLLECTIONS.CONTACTS)

export const getContacts = async () => {
  const snap = await getDocs(query(col(), orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const getContact = async (id) => {
  const snap = await getDoc(doc(db, COLLECTIONS.CONTACTS, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const createContact = (data) =>
  addDoc(col(), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })

export const updateContact = (id, data) =>
  updateDoc(doc(db, COLLECTIONS.CONTACTS, id), { ...data, updatedAt: serverTimestamp() })

export const deleteContact = (id) =>
  deleteDoc(doc(db, COLLECTIONS.CONTACTS, id))

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

// Bulk import: splits into batches of 400 to stay under Firestore's 500 op limit
export const batchImportContacts = async (contacts) => {
  const CHUNK = 400
  for (let i = 0; i < contacts.length; i += CHUNK) {
    const chunk = contacts.slice(i, i + CHUNK)
    const batch = writeBatch(db)
    chunk.forEach((contact) => {
      const ref = doc(col())
      batch.set(ref, { ...contact, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    })
    await batch.commit()
  }
}
