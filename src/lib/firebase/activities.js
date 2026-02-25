import { db } from '@/config/firebase'
import {
  collection, addDoc, getDocs, query, orderBy, serverTimestamp, limit
} from 'firebase/firestore'

export const getActivities = async (parentCollection, parentId, maxResults = 50) => {
  const col = collection(db, parentCollection, parentId, 'activities')
  const snap = await getDocs(query(col, orderBy('occurredAt', 'desc'), limit(maxResults)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const logActivity = async (parentCollection, parentId, data) => {
  const col = collection(db, parentCollection, parentId, 'activities')
  return addDoc(col, { ...data, createdAt: serverTimestamp() })
}
