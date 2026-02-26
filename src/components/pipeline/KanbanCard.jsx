import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { DollarSign, Calendar, User, GripVertical } from 'lucide-react'

const formatValue = (v) => {
  if (!v) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v)
}

const formatDate = (d) => {
  if (!d) return null
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function KanbanCard({ deal, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  }

  const isClosingSoon = deal.closingDate && (() => {
    const days = Math.round((new Date(deal.closingDate + 'T12:00:00') - new Date()) / 86400000)
    return days >= 0 && days <= 14
  })()

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-gray-900 border border-gray-800 rounded-lg p-3 cursor-pointer hover:border-gray-700 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 text-gray-700 cursor-grab active:cursor-grabbing flex-shrink-0 hover:text-gray-500"
        >
          <GripVertical size={14} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate leading-snug">{deal.title}</p>

          {deal.value > 0 && (
            <p className="text-xs font-semibold text-emerald-400 mt-1">{formatValue(deal.value)}</p>
          )}

          <div className="mt-2 space-y-1">
            {deal.contactName && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <User size={10} className="flex-shrink-0" />
                <span className="truncate">{deal.contactName}</span>
              </div>
            )}
            {deal.closingDate && (
              <div className={`flex items-center gap-1.5 text-xs ${isClosingSoon ? 'text-amber-400' : 'text-gray-500'}`}>
                <Calendar size={10} className="flex-shrink-0" />
                {formatDate(deal.closingDate)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
