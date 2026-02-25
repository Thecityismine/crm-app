import { db } from '@/config/firebase'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, orderBy, serverTimestamp, onSnapshot
} from 'firebase/firestore'
import { COLLECTIONS } from '@/config/constants'

const col = () => collection(db, COLLECTIONS.COMPANIES)

export const getCompanies = async () => {
  const snap = await getDocs(query(col(), orderBy('name')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const getCompany = async (id) => {
  const snap = await getDoc(doc(db, COLLECTIONS.COMPANIES, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const createCompany = (data) =>
  addDoc(col(), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })

export const updateCompany = (id, data) =>
  updateDoc(doc(db, COLLECTIONS.COMPANIES, id), { ...data, updatedAt: serverTimestamp() })

export const deleteCompany = (id) => deleteDoc(doc(db, COLLECTIONS.COMPANIES, id))

export const subscribeToCompanies = (callback) =>
  onSnapshot(query(col(), orderBy('name')), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )
