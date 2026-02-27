import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, User, Briefcase, RefreshCw } from 'lucide-react'

// Full class strings for Tailwind JIT
const PRIORITY_DOT = {
  urgent: 'bg-red-500',
  high:   'bg-orange-500',
  medium: 'bg-yellow-500',
  low:    'bg-blue-400',
}
const PRIORITY_TEXT = {
  urgent: 'text-red-400',
  high:   'text-orange-400',
  medium: 'text-yellow-400',
  low:    'text-blue-400',
}
const PRIORITY_LABELS = {
  urgent: 'Urgent',
  high:   'High',
  medium: 'Medium',
  low:    'Low',
}

function formatDueDate(d) {
  if (!d) return null
  const date = new Date(d + 'T12:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((date - today) / 86400000)

  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`,                                             overdue: true }
  if (diff === 0) return { label: 'Due today',                                                             today: true }
  if (diff === 1) return { label: 'Tomorrow',                                                              soon: true }
  if (diff <= 3)  return { label: `In ${diff} days`,                                                      soon: true }
  if (diff <= 7)  return { label: `Due ${date.toLocaleDateString('en-US', { weekday: 'short' })}`,        soon: true }
  return           { label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),          soon: false }
}

export default function TaskItem({ task, onToggle, onDelete }) {
  const navigate = useNavigate()
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isComplete = task.status === 'completed'
  const due = formatDueDate(task.dueDate)
  const priority = task.priority || 'medium'

  const handleToggle = async (e) => {
    e.stopPropagation()
    setToggling(true)
    try { await onToggle(task) } finally { setToggling(false) }
  }

  const handleDelete = async (e) => {
    e.stopPropagation()
    setDeleting(true)
    try { await onDelete(task.id) } finally { setDeleting(false) }
  }

  return (
    <div className={`group flex items-start gap-3 py-3 px-4 border-b border-gray-800/60 last:border-0 hover:bg-gray-800/30 transition-colors ${isComplete ? 'opacity-50' : ''}`}>

      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={toggling}
        className={`flex-shrink-0 mt-0.5 rounded border transition-colors ${
          isComplete
            ? 'bg-green-500 border-green-500'
            : 'border-gray-600 hover:border-gray-400 bg-transparent'
        }`}
        style={{ width: 18, height: 18 }}
        aria-label={isComplete ? 'Mark incomplete' : 'Mark complete'}
      >
        {isComplete && (
          <svg viewBox="0 0 12 12" fill="none" className="w-full h-full p-0.5">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">

        {/* Title row */}
        <div className="flex items-center gap-2 min-w-0">
          <p className={`text-sm leading-snug truncate ${isComplete ? 'line-through text-gray-500' : 'text-gray-200'}`}>
            {task.title}
          </p>
          {task.recurring && (
            <span className="flex-shrink-0 flex items-center gap-0.5 text-xs text-gray-600" title="Recurring task">
              <RefreshCw size={10} />
              <span className="hidden sm:inline">Recurring</span>
            </span>
          )}
        </div>

        {/* Meta row: priority · contact · deal · due date */}
        <div className="flex items-center gap-3 mt-1 flex-wrap">

          {/* Priority — dot + label */}
          {!isComplete && (
            <span className={`flex items-center gap-1 text-xs font-medium flex-shrink-0 ${PRIORITY_TEXT[priority] || 'text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[priority] || 'bg-gray-500'}`} />
              {PRIORITY_LABELS[priority] || priority}
            </span>
          )}

          {/* Contact link */}
          {task.contactName && (
            <button
              onClick={(e) => { e.stopPropagation(); if (task.contactId) navigate(`/contacts/${task.contactId}`) }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition-colors"
            >
              <User size={10} />
              <span className="truncate max-w-[140px]">{task.contactName}</span>
            </button>
          )}

          {/* Deal link */}
          {task.dealTitle && (
            <button
              onClick={(e) => { e.stopPropagation(); if (task.dealId) navigate(`/deals/${task.dealId}`) }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition-colors"
            >
              <Briefcase size={10} />
              <span className="truncate max-w-[140px]">{task.dealTitle}</span>
            </button>
          )}

          {/* Due date */}
          {due && (
            <span className={`text-xs flex-shrink-0 ${
              due.overdue ? 'text-red-400 font-medium' :
              due.today   ? 'text-amber-400 font-medium' :
              due.soon    ? 'text-yellow-500' :
                            'text-gray-600'
            }`}>
              {due.label}
            </span>
          )}
        </div>

        {/* Description preview */}
        {task.description && (
          <p className="text-xs text-gray-600 mt-1.5 truncate">{task.description}</p>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 transition-all p-1 rounded"
        aria-label="Delete task"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}
