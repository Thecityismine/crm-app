import { db } from '@/config/firebase'
import {
  collection, doc, addDoc, updateDoc, getDocs, getDoc,
  query, orderBy, serverTimestamp, onSnapshot
} from 'firebase/firestore'
import { COLLECTIONS } from '@/config/constants'

const col = () => collection(db, COLLECTIONS.PROPERTIES)

export const getProperties = async () => {
  const snap = await getDocs(query(col(), orderBy('name')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const getProperty = async (id) => {
  const snap = await getDoc(doc(db, COLLECTIONS.PROPERTIES, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const createProperty = (data) =>
  addDoc(col(), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })

export const updateProperty = (id, data) =>
  updateDoc(doc(db, COLLECTIONS.PROPERTIES, id), { ...data, updatedAt: serverTimestamp() })

export const getLeases = async (propertyId) => {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.PROPERTIES, propertyId, 'leases'), orderBy('leaseEnd'))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const createLease = (propertyId, data) =>
  addDoc(collection(db, COLLECTIONS.PROPERTIES, propertyId, 'leases'), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  })
