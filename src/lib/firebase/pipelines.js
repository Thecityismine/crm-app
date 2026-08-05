import { db } from '@/config/firebase'
import {
  collection, doc, addDoc, getDocs,
  query, orderBy, serverTimestamp, writeBatch
} from 'firebase/firestore'
import { COLLECTIONS } from '@/config/constants'
import { getPipelineConfig } from '@/lib/pipeline'

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
  // Unknown deal types fall back to the default template rather than placeholder names.
  const config = getPipelineConfig(dealType)
  const batch = writeBatch(db)
  config.stages.forEach((stageName, i) => {
    const stageRef = doc(collection(db, COLLECTIONS.PIPELINES, pipelineRef.id, 'stages'))
    const won = config.isWon(stageName)
    const lost = config.isLost(stageName)
    batch.set(stageRef, {
      name: stageName, orderIndex: i,
      // Probability ramps across the active stages; terminals are fixed at 100/0.
      probability: won ? 100 : lost ? 0 : Math.round((i / config.activeStages.length) * 100),
      isWon: won,
      isLost: lost,
    })
  })
  await batch.commit()
  return pipelineRef.id
}
