import { useEffect } from 'react'
import { useDealStore } from '@/store/dealStore'
import { usePipelineStore } from '@/store/pipelineStore'
import { subscribeToPipelineDeals, createDeal, updateDeal, moveDealStage } from '@/lib/firebase/deals'

export const useDeals = (pipelineId) => {
  const { deals, loading, setDeals, setLoading } = useDealStore()

  useEffect(() => {
    if (!pipelineId) return
    setLoading(true)
    const unsub = subscribeToPipelineDeals(pipelineId, (data) => {
      setDeals(data)
      setLoading(false)
    })
    return unsub
  }, [pipelineId])

  return { deals, loading, createDeal, updateDeal, moveDealStage }
}
