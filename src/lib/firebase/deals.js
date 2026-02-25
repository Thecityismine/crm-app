import { db } from '@/config/firebase'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import { COLLECTIONS } from '@/config/constants'

const col = () => collection(db, COLLECTIONS.DEALS)

export const getDeals = async (pipelineId = null) => {
  const q = pipelineId
    ? query(col(), where('pipelineId', '==', pipelineId), orderBy('createdAt', 'desc'))
    : query(col(), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const getDeal = async (id) => {
  const snap = await getDoc(doc(db, COLLECTIONS.DEALS, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const createDeal = (data) =>
  addDoc(col(), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })

export const updateDeal = (id, data) =>
  updateDoc(doc(db, COLLECTIONS.DEALS, id), { ...data, updatedAt: serverTimestamp() })

export const moveDealStage = (id, stageId) =>
  updateDoc(doc(db, COLLECTIONS.DEALS, id), { stageId, updatedAt: serverTimestamp() })

export const deleteDeal = (id) =>
  deleteDoc(doc(db, COLLECTIONS.DEALS, id))

export const subscribeToPipelineDeals = (pipelineId, callback) =>
  onSnapshot(
    query(col(), where('pipelineId', '==', pipelineId)),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )
