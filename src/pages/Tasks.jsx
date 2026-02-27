import { useState, useEffect, useMemo } from 'react'
import { Plus, CheckSquare, ChevronDown } from 'lucide-react'
import { getTasks, createTask, updateTask, deleteTask } from '@/lib/firebase/tasks'
import { getDeals } from '@/lib/firebase/deals'
import { useContactStore } from '@/store/contactStore'
import TaskItem from '@/components/tasks/TaskItem'

const FILTERS = [
  { key: 'open',      label: 'Open' },
  { key: 'today',     label: 'Today' },
  { key: 'overdue',   label: 'Overdue' },
  { key: 'upcoming',  label: 'Upcoming' },
  { key: 'completed', label: 'Done' },
]

const PRIORITIES = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
]

const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low']

// ── Date helpers ─────────────────────────────────────────────────────────────
function dateDiff(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T12:00:00')
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return Math.round((d - t) / 86400000)
}
function isToday(dateStr)    { const d = dateDiff(dateStr); return d !== null && d === 0 }
function isOverdue(dateStr)  { const d = dateDiff(dateStr); return d !== null && d < 0 }
function isUpcoming(dateStr) { const d = dateDiff(dateStr); return d !== null && d >= 0 }

// ── Group-by logic ────────────────────────────────────────────────────────────
function groupTasksBy(tasks, groupBy) {
  if (groupBy === 'none') return [{ key: 'all', label: null, tasks }]

  if (groupBy === 'priority') {
    const buckets = {}
    tasks.forEach((t) => {
      const p = t.priority || 'medium'
      if (!buckets[p]) buckets[p] = []
      buckets[p].push(t)
    })
    return PRIORITY_ORDER
      .filter((p) => buckets[p]?.length)
      .map((p) => ({ key: p, label: { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }[p], tasks: buckets[p] }))
  }

  if (groupBy === 'contact') {
    const buckets = {}
    tasks.forEach((t) => {
      const key = t.contactId || '_none'
      const label = t.contactName || 'No Contact'
      if (!buckets[key]) buckets[key] = { label, tasks: [] }
      buckets[key].tasks.push(t)
    })
    return Object.entries(buckets)
      .sort(([ka, a], [kb, b]) => {
        if (ka === '_none') return 1
        if (kb === '_none') return -1
        return a.label.localeCompare(b.label)
      })
      .map(([key, { label, tasks }]) => ({ key, label, tasks }))
  }

  if (groupBy === 'deal') {
    const buckets = {}
    tasks.forEach((t) => {
      const key = t.dealId || '_none'
      const label = t.dealTitle || 'No Deal'
      if (!buckets[key]) buckets[key] = { label, tasks: [] }
      buckets[key].tasks.push(t)
    })
    return Object.entries(buckets)
      .sort(([ka, a], [kb, b]) => {
        if (ka === '_none') return 1
        if (kb === '_none') return -1
        return a.label.localeCompare(b.label)
      })
      .map(([key, { label, tasks }]) => ({ key, label, tasks }))
  }

  if (groupBy === 'dueDate') {
    const buckets = {
      overdue:  { label: 'Overdue',       tasks: [] },
      today:    { label: 'Today',          tasks: [] },
      tomorrow: { label: 'Tomorrow',       tasks: [] },
      week:     { label: 'This Week',      tasks: [] },
      later:    { label: 'Later',          tasks: [] },
      none:     { label: 'No Due Date',    tasks: [] },
    }
    tasks.forEach((t) => {
      const d = dateDiff(t.dueDate)
      if (d === null)      buckets.none.tasks.push(t)
      else if (d < 0)      buckets.overdue.tasks.push(t)
      else if (d === 0)    buckets.today.tasks.push(t)
      else if (d === 1)    buckets.tomorrow.tasks.push(t)
      else if (d <= 7)     buckets.week.tasks.push(t)
      else                 buckets.later.tasks.push(t)
    })
    return Object.entries(buckets)
      .filter(([, { tasks }]) => tasks.length)
      .map(([key, { label, tasks }]) => ({ key, label, tasks }))
  }

  return [{ key: 'all', label: null, tasks }]
}

// ── Add task inline form ──────────────────────────────────────────────────────
function AddTaskForm({ contacts, deals, onAdd, onCancel }) {
  const [title,       setTitle]       = useState('')
  const [priority,    setPriority]    = useState('medium')
  const [dueDate,     setDueDate]     = useState('')
  const [contactId,   setContactId]   = useState('')
  const [dealId,      setDealId]      = useState('')
  const [description, setDescription] = useState('')
  const [saving,      setSaving]      = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const contact = contacts.find((c) => c.id === contactId)
    const deal    = deals.find((d) => d.id === dealId)
    try {
      await onAdd({
        title:       title.trim(),
        priority,
        dueDate:     dueDate || null,
        contactId:   contactId || null,
        contactName: contact ? `${contact.firstName} ${contact.lastName}` : null,
        dealId:      dealId || null,
        dealTitle:   deal?.title || null,
        description: description.trim() || null,
        status:      'open',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-4 space-y-3">
      <input
        autoFocus
        className="input text-sm"
        placeholder="Task title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />

      <div className="flex gap-2 flex-wrap">
        <select className="input text-xs flex-1 min-w-[110px]" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        <input
          className="input text-xs flex-1 min-w-[130px]"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        <select className="input text-xs flex-1 min-w-[130px]" value={contactId} onChange={(e) => setContactId(e.target.value)}>
          <option value="">— No contact —</option>
          {contacts
            .slice()
            .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
            .map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)
          }
        </select>

        <select className="input text-xs flex-1 min-w-[130px]" value={dealId} onChange={(e) => setDealId(e.target.value)}>
          <option value="">— No deal —</option>
          {deals
            .slice()
            .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
            .map((d) => <option key={d.id} value={d.id}>{d.title}</option>)
          }
        </select>
      </div>

      <textarea
        className="input text-xs resize-none"
        rows={2}
        placeholder="Notes or description (optional)..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary text-xs px-3 py-1.5">
          {saving ? 'Adding...' : 'Add Task'}
        </button>
      </div>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Tasks() {
  const { contacts } = useContactStore()
  const [tasks,   setTasks]   = useState([])
  const [deals,   setDeals]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('open')
  const [groupBy, setGroupBy] = useState('none')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    Promise.all([
      getTasks().catch(() => []),
      getDeals().catch(() => []),
    ]).then(([t, d]) => {
      setTasks(t)
      setDeals(d)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'completed')
    const duePriority = (t) => {
      if (!t.dueDate) return 99
      if (isOverdue(t.dueDate)) return 0
      if (isToday(t.dueDate))   return 1
      return 2
    }
    switch (filter) {
      case 'open':      return [...open].sort((a, b) => duePriority(a) - duePriority(b))
      case 'today':     return open.filter((t) => isToday(t.dueDate))
      case 'overdue':   return open.filter((t) => isOverdue(t.dueDate))
      case 'upcoming':  return open.filter((t) => isUpcoming(t.dueDate)).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      case 'completed': return tasks.filter((t) => t.status === 'completed')
      default:          return tasks
    }
  }, [tasks, filter])

  const counts = useMemo(() => ({
    open:      tasks.filter((t) => t.status !== 'completed').length,
    today:     tasks.filter((t) => t.status !== 'completed' && isToday(t.dueDate)).length,
    overdue:   tasks.filter((t) => t.status !== 'completed' && isOverdue(t.dueDate)).length,
    upcoming:  tasks.filter((t) => t.status !== 'completed' && isUpcoming(t.dueDate)).length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  }), [tasks])

  const groups = useMemo(() => groupTasksBy(filtered, groupBy), [filtered, groupBy])

  const handleAdd = async (data) => {
    const { id } = await createTask(data)
    setTasks((prev) => [{ id, ...data }, ...prev])
    setShowAdd(false)
  }

  const handleToggle = async (task) => {
    const newStatus = task.status === 'completed' ? 'open' : 'completed'
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t))
    try {
      await updateTask(task.id, { status: newStatus })
    } catch {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: task.status } : t))
    }
  }

  const handleDelete = async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    try { await deleteTask(id) } catch (err) { console.warn('Delete failed:', err) }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Tasks</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {counts.open} open
            {counts.overdue > 0 && <span className="text-red-400"> · {counts.overdue} overdue</span>}
          </p>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="btn-primary flex items-center justify-center gap-2 sm:px-4 p-2"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Task</span>
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <AddTaskForm
          contacts={contacts}
          deals={deals}
          onAdd={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-3 border-b border-gray-800">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors -mb-px ${
              filter === key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
            {counts[key] > 0 && (
              <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
                filter === key ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-500'
              }`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Group-by toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-600">Group by</span>
        <div className="relative">
          <select
            className="input text-xs py-1 pr-6 pl-2 w-auto appearance-none"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
          >
            <option value="none">None</option>
            <option value="priority">Priority</option>
            <option value="contact">Contact</option>
            <option value="deal">Deal</option>
            <option value="dueDate">Due Date</option>
          </select>
          <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        <span className="text-xs text-gray-700 ml-auto">
          {filtered.length} task{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="card py-12 text-center text-gray-600 text-sm">Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-14 text-center">
          <CheckSquare size={28} className="text-gray-700 mb-2" />
          <p className="text-sm text-gray-500">
            {filter === 'completed' ? 'No completed tasks yet — check off a task to see it here' :
             filter === 'overdue'   ? 'No overdue tasks' :
             filter === 'today'     ? 'Nothing due today' :
             filter === 'upcoming'  ? 'No upcoming tasks' :
                                      "No open tasks — you're all caught up!"}
          </p>
          {filter === 'open' && (
            <button onClick={() => setShowAdd(true)} className="mt-3 text-xs text-blue-400 hover:text-blue-300">
              Add your first task
            </button>
          )}
        </div>
      ) : groupBy === 'none' ? (
        <div className="card overflow-hidden">
          {filtered.map((task) => (
            <TaskItem key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(({ key, label, tasks: groupTasks }) => (
            <div key={key} className="card overflow-hidden">
              {label && (
                <div className="px-4 py-2 bg-gray-800/60 border-b border-gray-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
                  <span className="text-xs text-gray-600">{groupTasks.length}</span>
                </div>
              )}
              {groupTasks.map((task) => (
                <TaskItem key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
