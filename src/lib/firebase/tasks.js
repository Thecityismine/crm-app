import { db } from '@/config/firebase'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy, onSnapshot, serverTimestamp
} from 'firebase/firestore'
import { COLLECTIONS } from '@/config/constants'

const col = () => collection(db, COLLECTIONS.TASKS)

export const getTasks = async (assignedTo = null) => {
  const q = assignedTo
    ? query(col(), where('assignedTo', '==', assignedTo), orderBy('dueDate'))
    : query(col(), orderBy('dueDate'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const createTask = (data) =>
  addDoc(col(), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })

export const updateTask = (id, data) =>
  updateDoc(doc(db, COLLECTIONS.TASKS, id), { ...data, updatedAt: serverTimestamp() })

export const completeTask = (id) =>
  updateDoc(doc(db, COLLECTIONS.TASKS, id), {
    status: 'completed', completedAt: serverTimestamp(), updatedAt: serverTimestamp()
  })

export const deleteTask = (id) => deleteDoc(doc(db, COLLECTIONS.TASKS, id))

export const subscribeToMyTasks = (userId, callback) =>
  onSnapshot(
    query(col(), where('assignedTo', '==', userId), where('status', '!=', 'completed'), orderBy('status'), orderBy('dueDate')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )
