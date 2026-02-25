import { differenceInDays } from 'date-fns'

export const getDealAge = (createdAt) => {
  if (!createdAt) return 0
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt)
  return differenceInDays(new Date(), date)
}

export const groupDealsByStage = (deals, stages) => {
  return stages.reduce((acc, stage) => {
    acc[stage.id] = deals.filter((d) => d.stageId === stage.id)
    return acc
  }, {})
}

export const getPipelineValue = (deals) =>
  deals.reduce((sum, deal) => sum + (deal.value || 0), 0)
