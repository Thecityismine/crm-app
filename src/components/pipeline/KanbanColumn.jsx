import { useDroppable } from '@dnd-kit/core'
import KanbanCard from './KanbanCard'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'

const formatTotal = (v) => {
  if (!v) return null
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

const STAGE_COLORS = {
  Lead:        'border-gray-600',
  Qualified:   'border-blue-500/60',
  Proposal:    'border-yellow-500/60',
  Negotiation: 'border-orange-500/60',
  Won:         'border-emerald-500/60',
  Lost:        'border-red-500/40',
}

export default function KanbanColumn({ stage, deals, onCardClick, onAddDeal, collapsed, onToggleCollapse }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const total = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
  const accentBorder = STAGE_COLORS[stage] || 'border-gray-700'

  if (collapsed) {
    return (
      <div
        className="flex-shrink-0 w-10 flex flex-col items-center gap-3 py-3 rounded-xl bg-gray-800/20 cursor-pointer hover:bg-gray-800/40 transition-colors"
        onClick={onToggleCollapse}
        title={`${stage} — ${deals.length} deal${deals.length !== 1 ? 's' : ''} (click to expand)`}
      >
        <ChevronRight size={13} className="text-gray-600 flex-shrink-0" />
        <span
          className="text-xs font-semibold text-gray-600 uppercase tracking-wide select-none"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {stage}
        </span>
        {deals.length > 0 && (
          <span className="text-xs text-gray-700 bg-gray-800 px-1.5 py-0.5 rounded-full font-medium">
            {deals.length}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex-shrink-0 w-60 flex flex-col">
      {/* Column header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCollapse}
            className="text-gray-700 hover:text-gray-400 transition-colors flex-shrink-0"
            title="Collapse column"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{stage}</span>
          <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full font-medium">
            {deals.length}
          </span>
        </div>
        {total > 0 && (
          <span className="text-xs text-emerald-500 font-semibold">{formatTotal(total)}</span>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[300px] rounded-xl border-t-2 ${accentBorder} pt-3 px-2 pb-2 space-y-2 transition-colors ${
          isOver ? 'bg-gray-800/60 ring-1 ring-inset ring-blue-500/30' : 'bg-gray-800/20'
        }`}
      >
        {deals.map((deal) => (
          <KanbanCard key={deal.id} deal={deal} onClick={() => onCardClick(deal)} />
        ))}

        <button
          onClick={() => onAddDeal(stage)}
          className="w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs text-gray-700 hover:text-gray-400 hover:bg-gray-700/30 transition-colors"
        >
          <Plus size={12} /> Add deal
        </button>
      </div>
    </div>
  )
}
