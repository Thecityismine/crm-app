import { useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import KanbanColumn from './KanbanColumn'
import KanbanCard from './KanbanCard'
import { getDeals, updateDeal } from '@/lib/firebase/deals'

export const PIPELINE_STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']

export default function KanbanBoard({ onAddDeal, onDealClick, refreshKey }) {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeDeal, setActiveDeal] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  useEffect(() => {
    setLoading(true)
    getDeals()
      .then(setDeals)
      .catch(console.warn)
      .finally(() => setLoading(false))
  }, [refreshKey])

  const handleDragStart = ({ active }) => {
    setActiveDeal(deals.find((d) => d.id === active.id) || null)
  }

  const handleDragEnd = async ({ active, over }) => {
    setActiveDeal(null)
    if (!over) return
    const newStage = over.id
    if (!PIPELINE_STAGES.includes(newStage)) return
    const deal = deals.find((d) => d.id === active.id)
    if (!deal || deal.stage === newStage) return

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) => (d.id === active.id ? { ...d, stage: newStage } : d))
    )
    try {
      await updateDeal(active.id, { stage: newStage })
    } catch (err) {
      console.warn('Move failed:', err)
      // Revert on failure
      setDeals((prev) =>
        prev.map((d) => (d.id === active.id ? { ...d, stage: deal.stage } : d))
      )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-600 text-sm">
        Loading pipeline...
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
        {PIPELINE_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            deals={deals.filter((d) => d.stage === stage)}
            onCardClick={onDealClick}
            onAddDeal={onAddDeal}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDeal && (
          <div className="opacity-90 shadow-2xl rotate-1">
            <KanbanCard deal={activeDeal} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
