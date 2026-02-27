import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, User, GripVertical, Clock } from 'lucide-react'

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

// Returns { color: 'red'|'yellow'|null, label: string|null }
function getCloseMeta(closingDate) {
  if (!closingDate) return { color: null, label: null }
  const days = Math.round((new Date(closingDate + 'T12:00:00') - new Date()) / 86400000)
  if (days < 0) return { color: 'red', label: 'Overdue' }
  if (days === 0) return { color: 'red', label: 'Due today' }
  if (days <= 7) return { color: 'yellow', label: `${days}d left` }
  return { color: null, label: null }
}

function getDaysInStage(deal) {
  const dateStr = deal.stageEnteredAt || deal.createdAt
  if (!dateStr) return null
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
}

// Full class strings so Tailwind JIT picks them up
const URGENCY_BORDER = {
  red:    'border-l-2 border-l-red-500',
  yellow: 'border-l-2 border-l-yellow-500',
}

const DATE_COLOR = {
  red:    'text-red-400',
  yellow: 'text-yellow-400',
}

export default function KanbanCard({ deal, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  }

  const closeMeta = getCloseMeta(deal.closingDate)
  const daysInStage = getDaysInStage(deal)
  const urgencyBorder = closeMeta.color ? URGENCY_BORDER[closeMeta.color] : ''

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gray-900 border border-gray-800 rounded-lg p-3 cursor-pointer hover:border-gray-700 transition-colors ${urgencyBorder}`}
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
              <div className={`flex items-center gap-1.5 text-xs ${closeMeta.color ? DATE_COLOR[closeMeta.color] : 'text-gray-500'}`}>
                <Calendar size={10} className="flex-shrink-0" />
                <span>{formatDate(deal.closingDate)}</span>
                {closeMeta.label && (
                  <span className="font-semibold">· {closeMeta.label}</span>
                )}
              </div>
            )}
          </div>

          {daysInStage && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-700">
              <Clock size={9} className="flex-shrink-0" />
              {daysInStage} in stage
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
