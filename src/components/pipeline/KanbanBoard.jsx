import { useState, useEffect, useRef } from 'react'
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
import { useSettingsStore, PIPELINE_TEMPLATES } from '@/store/settingsStore'
import { X } from 'lucide-react'

// Kept for backward-compat; consumers should prefer getPipelineStages() from the store
export const PIPELINE_STAGES = PIPELINE_TEMPLATES.default

export default function KanbanBoard({ onAddDeal, onDealClick, refreshKey }) {
  const pipelineTemplate = useSettingsStore((s) => s.pipelineTemplate)
  const stages = PIPELINE_TEMPLATES[pipelineTemplate] || PIPELINE_TEMPLATES.default
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeDeal, setActiveDeal] = useState(null)
  const [collapsedStages, setCollapsedStages] = useState(new Set())
  const [undoToast, setUndoToast] = useState(null) // { dealId, oldStage, newStage }
  const undoTimerRef = useRef(null)
  const pendingMoveRef = useRef(null) // { dealId, newStage, oldStage }

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

  // Cleanup timer on unmount
  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current) }, [])

  const commitMove = ({ dealId, newStage, oldStage }) => {
    updateDeal(dealId, { stage: newStage, stageEnteredAt: new Date().toISOString() }).catch(() => {
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, stage: oldStage } : d))
    })
  }

  const flushPending = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    if (pendingMoveRef.current) {
      commitMove(pendingMoveRef.current)
      pendingMoveRef.current = null
    }
    setUndoToast(null)
  }

  const handleDragStart = ({ active }) => {
    // If another move is pending, commit it now before starting new drag
    flushPending()
    setActiveDeal(deals.find((d) => d.id === active.id) || null)
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveDeal(null)
    if (!over) return
    const newStage = over.id
    if (!stages.includes(newStage)) return
    const deal = deals.find((d) => d.id === active.id)
    if (!deal || deal.stage === newStage) return

    const oldStage = deal.stage
    const move = { dealId: active.id, newStage, oldStage }

    // Optimistic update
    setDeals((prev) => prev.map((d) => d.id === active.id ? { ...d, stage: newStage } : d))

    // Show undo toast and start 5s delayed write
    pendingMoveRef.current = move
    setUndoToast({ dealId: active.id, oldStage, newStage })
    undoTimerRef.current = setTimeout(() => {
      setUndoToast(null)
      pendingMoveRef.current = null
      commitMove(move)
    }, 5000)
  }

  const handleUndo = () => {
    if (!undoToast) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = null
    pendingMoveRef.current = null
    setDeals((prev) =>
      prev.map((d) => d.id === undoToast.dealId ? { ...d, stage: undoToast.oldStage } : d)
    )
    setUndoToast(null)
  }

  const dismissToast = () => {
    // Hide toast but let timer still commit
    setUndoToast(null)
  }

  const toggleCollapse = (stage) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-600 text-sm">
        Loading pipeline...
      </div>
    )
  }

  return (
    <div className="relative">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              deals={deals.filter((d) => d.stage === stage)}
              onCardClick={onDealClick}
              onAddDeal={onAddDeal}
              collapsed={collapsedStages.has(stage)}
              onToggleCollapse={() => toggleCollapse(stage)}
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

      {/* Undo toast */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-800 border border-gray-700 text-gray-200 text-sm px-4 py-3 rounded-xl shadow-2xl">
          <span>
            Moved to <span className="font-semibold">{undoToast.newStage}</span>
          </span>
          <button
            onClick={handleUndo}
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            Undo
          </button>
          <button
            onClick={dismissToast}
            className="text-gray-600 hover:text-gray-400 ml-1 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
