import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { localDateOnly, daysFromToday } from '@/lib/dates'
import { RECURRENCE_OPTIONS, RECURRENCE_LABELS, nextDueDate } from '@/lib/recurrence'
import { Trash2, User, Briefcase, RefreshCw, ChevronDown, AlignLeft } from 'lucide-react'

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
const PRIORITY_VALUES = ['urgent', 'high', 'medium', 'low']

function formatDueDate(d) {
  const date = localDateOnly(d)
  if (!date) return null
  // Both operands are local midnight. This used to measure a noon-anchored due
  // date against midnight today, so Math.round(0.5) made every label one day
  // late: a task due today read "Tomorrow" and one due yesterday read "Due
  // today" — while the Tasks page grouped the same task correctly under Today.
  const diff = daysFromToday(d)

  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`,                                             overdue: true }
  if (diff === 0) return { label: 'Due today',                                                             today: true }
  if (diff === 1) return { label: 'Tomorrow',                                                              soon: true }
  if (diff <= 3)  return { label: `In ${diff} days`,                                                      soon: true }
  if (diff <= 7)  return { label: `Due ${date.toLocaleDateString('en-US', { weekday: 'short' })}`,        soon: true }
  return           { label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),          soon: false }
}

function longDate(dateStr) {
  const d = localDateOnly(dateStr)
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null
}

// The editable shape of a task. Kept separate from the task itself so the row
// keeps showing what is saved while the panel below it is being edited.
const toDraft = (t) => ({
  title:       t.title || '',
  priority:    t.priority || 'medium',
  dueDate:     t.dueDate ? String(t.dueDate).slice(0, 10) : '',
  recurrence:  RECURRENCE_LABELS[t.recurrence] ? t.recurrence : 'none',
  contactId:   t.contactId || '',
  dealId:      t.dealId || '',
  description: t.description || '',
})

export default function TaskItem({ task, onToggle, onDelete, onUpdate, contacts = [], deals = [] }) {
  const navigate = useNavigate()
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft,    setDraft]    = useState(() => toDraft(task))
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  // Follow the saved task while the panel is shut. Once it is open the draft is
  // the user's, and an unrelated store update — completing another task refreshes
  // the whole list — must not wipe what they have typed.
  useEffect(() => {
    if (!expanded) setDraft(toDraft(task))
  }, [task, expanded])

  const isComplete = task.status === 'completed'
  const due = formatDueDate(task.dueDate)
  const priority = task.priority || 'medium'
  const repeats = RECURRENCE_LABELS[task.recurrence]
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(task))

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }))

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

  const handleSave = async (e) => {
    e.preventDefault()
    if (!draft.title.trim() || !onUpdate) return
    setSaving(true)
    setError('')
    const contact = contacts.find((c) => c.id === draft.contactId)
    const deal    = deals.find((d) => d.id === draft.dealId)
    try {
      await onUpdate(task.id, {
        title:       draft.title.trim(),
        priority:    draft.priority,
        dueDate:     draft.dueDate || null,
        recurrence:  draft.recurrence,
        contactId:   draft.contactId || null,
        contactName: contact ? `${contact.firstName} ${contact.lastName}` : null,
        dealId:      draft.dealId || null,
        dealTitle:   deal?.title || null,
        description: draft.description.trim() || null,
      })
      setExpanded(false)
    } catch (err) {
      setError(err?.message ?? 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setDraft(toDraft(task))
    setError('')
    setExpanded(false)
  }

  // The row itself opens the panel. It cannot be a <button> — the contact and
  // deal shortcuts inside it are buttons of their own, and nesting them is
  // invalid and swallows their clicks in some browsers.
  const handleRowKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setExpanded((s) => !s)
    }
  }

  // What the next occurrence will be if this is saved and then completed today.
  const nextUp = draft.recurrence !== 'none'
    ? longDate(nextDueDate(draft.dueDate, draft.recurrence))
    : null

  return (
    <div className={`border-b border-gray-800/60 last:border-0 ${expanded ? 'bg-gray-800/25' : ''}`}>
      <div className={`group flex items-start gap-3 py-3 px-4 transition-colors ${expanded ? '' : 'hover:bg-gray-800/30'} ${isComplete ? 'opacity-50' : ''}`}>

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

        {/* Content — click to expand */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={() => setExpanded((s) => !s)}
          onKeyDown={handleRowKeyDown}
          className="flex-1 min-w-0 cursor-pointer text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/60 rounded"
        >

          {/* Title row */}
          <div className="flex items-center gap-2 min-w-0">
            <p className={`text-sm leading-snug truncate ${isComplete ? 'line-through text-gray-500' : 'text-gray-200'}`}>
              {task.title}
            </p>
            {repeats && (
              <span className="flex-shrink-0 flex items-center gap-0.5 text-xs text-gray-600" title={`Repeats ${repeats.toLowerCase()}`}>
                <RefreshCw size={10} />
                <span className="hidden sm:inline">{repeats}</span>
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

            {/* There is more here than the row shows */}
            {!expanded && task.description && (
              <span className="flex items-center text-gray-700" title="Has notes">
                <AlignLeft size={10} />
              </span>
            )}
          </div>

          {/* Description preview — the full text is in the panel below */}
          {!expanded && task.description && (
            <p className="text-xs text-gray-600 mt-1.5 truncate">{task.description}</p>
          )}
        </div>

        {/* Expand caret */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((s) => !s) }}
          className="flex-shrink-0 text-gray-700 hover:text-gray-400 transition-all p-1 rounded"
          aria-label={expanded ? 'Collapse task' : 'Expand task'}
        >
          <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`flex-shrink-0 text-gray-700 hover:text-red-400 transition-all p-1 rounded ${
            expanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          aria-label="Delete task"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Expanded detail — edit everything in place */}
      {expanded && (
        <form onSubmit={handleSave} className="px-4 pb-4 pl-[3.25rem] space-y-3">

          <div>
            <label className="label text-xs">Title</label>
            <input className="input text-sm" value={draft.title} onChange={set('title')} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Priority</label>
              <select className="input text-xs" value={draft.priority} onChange={set('priority')}>
                {PRIORITY_VALUES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>

            <div>
              <label className="label text-xs">Due date</label>
              <input className="input text-xs" type="date" value={draft.dueDate} onChange={set('dueDate')} />
            </div>

            <div>
              <label className="label text-xs">Repeat</label>
              <select className="input text-xs" value={draft.recurrence} onChange={set('recurrence')}>
                {RECURRENCE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div>
              <label className="label text-xs">Contact</label>
              <select className="input text-xs" value={draft.contactId} onChange={set('contactId')}>
                <option value="">— No contact —</option>
                {contacts
                  .slice()
                  .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
                  .map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)
                }
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="label text-xs">Deal</label>
              <select className="input text-xs" value={draft.dealId} onChange={set('dealId')}>
                <option value="">— No deal —</option>
                {deals
                  .slice()
                  .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
                  .map((d) => <option key={d.id} value={d.id}>{d.title}</option>)
                }
              </select>
            </div>
          </div>

          {nextUp && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <RefreshCw size={10} className="flex-shrink-0" />
              Ticking this off opens the next one for <span className="text-gray-400">{nextUp}</span>.
            </p>
          )}

          <div>
            <label className="label text-xs">Notes</label>
            <textarea
              className="input text-xs resize-none"
              rows={3}
              placeholder="Notes or description..."
              value={draft.description}
              onChange={set('description')}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={handleCancel} className="btn-secondary text-xs px-3 py-1.5">
              {dirty ? 'Cancel' : 'Close'}
            </button>
            <button type="submit" disabled={saving || !dirty} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
