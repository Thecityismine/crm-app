import { db } from '@/config/firebase'
import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, orderBy, serverTimestamp, writeBatch
} from 'firebase/firestore'
import { COLLECTIONS, PIPELINE_TEMPLATES } from '@/config/constants'

export const getPipelines = async () => {
  const snap = await getDocs(query(collection(db, COLLECTIONS.PIPELINES), orderBy('createdAt')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const getPipelineStages = async (pipelineId) => {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.PIPELINES, pipelineId, 'stages'), orderBy('orderIndex'))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const createPipelineWithStages = async (name, dealType, userId) => {
  const pipelineRef = await addDoc(collection(db, COLLECTIONS.PIPELINES), {
    name, dealType, isActive: true, createdBy: userId,
    createdAt: serverTimestamp()
  })
  const stageNames = PIPELINE_TEMPLATES[dealType] || ['Stage 1', 'Stage 2', 'Stage 3']
  const batch = writeBatch(db)
  stageNames.forEach((stageName, i) => {
    const stageRef = doc(collection(db, COLLECTIONS.PIPELINES, pipelineRef.id, 'stages'))
    batch.set(stageRef, {
      name: stageName, orderIndex: i,
      probability: Math.round((i / stageNames.length) * 100),
      isWon: i === stageNames.length - 1,
      isLost: false,
    })
  })
  await batch.commit()
  return pipelineRef.id
}
