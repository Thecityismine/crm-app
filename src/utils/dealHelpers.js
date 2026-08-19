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

/**
 * Stamp stageEnteredAt when a save actually moves the deal to a different stage.
 *
 * "Days in stage" reads stageEnteredAt and falls back to createdAt, so a deal
 * whose stage changed without this stamp reports its age since creation
 * instead. Only drag-and-drop and the table's advance button used to set it,
 * so moving a deal through the edit modal or the detail page left the counter
 * measuring the wrong thing entirely.
 *
 * Pass prevStage as null for a new deal.
 */
export const withStageTimestamp = (data, prevStage) =>
  data.stage && data.stage !== prevStage
    ? { ...data, stageEnteredAt: new Date().toISOString() }
    : data
