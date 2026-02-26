import { useState, useEffect, useMemo } from 'react'
import { Plus, CheckSquare } from 'lucide-react'
import { getTasks, createTask, updateTask, deleteTask } from '@/lib/firebase/tasks'
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

function isToday(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr + 'T12:00:00')
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const end = new Date(t); end.setDate(end.getDate() + 1)
  return d >= t && d < end
}

function isOverdue(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr + 'T12:00:00')
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return d < t
}

function isUpcoming(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr + 'T12:00:00')
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return d >= t
}

function AddTaskForm({ contacts, onAdd, onCancel }) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [contactId, setContactId] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const contact = contacts.find((c) => c.id === contactId)
    try {
      await onAdd({
        title:       title.trim(),
        priority,
        dueDate:     dueDate || null,
        contactId:   contactId || null,
        contactName: contact ? `${contact.firstName} ${contact.lastName}` : null,
        status:      'open',
      })
      setTitle('')
      setPriority('medium')
      setDueDate('')
      setContactId('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-4 space-y-3"
    >
      <input
        autoFocus
        className="input text-sm"
        placeholder="Task title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <div className="flex gap-2 flex-wrap">
        <select
          className="input text-xs flex-1 min-w-[120px]"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <input
          className="input text-xs flex-1 min-w-[140px]"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        <select
          className="input text-xs flex-1 min-w-[140px]"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
        >
          <option value="">— No contact —</option>
          {contacts
            .slice()
            .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
            .map((c) => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))
          }
        </select>
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary text-xs px-3 py-1.5">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary text-xs px-3 py-1.5">
          {saving ? 'Adding...' : 'Add Task'}
        </button>
      </div>
    </form>
  )
}

export default function Tasks() {
  const { contacts } = useContactStore()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    getTasks()
      .then(setTasks)
      .catch(console.warn)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'completed')
    const duePriority = (t) => {
      if (!t.dueDate) return 99
      if (isOverdue(t.dueDate)) return 0
      if (isToday(t.dueDate)) return 1
      return 2
    }
    switch (filter) {
      case 'open':
        return [...open].sort((a, b) => duePriority(a) - duePriority(b))
      case 'today':
        return open.filter((t) => isToday(t.dueDate))
      case 'overdue':
        return open.filter((t) => isOverdue(t.dueDate))
      case 'upcoming':
        return open.filter((t) => isUpcoming(t.dueDate)).sort((a, b) =>
          (a.dueDate || '').localeCompare(b.dueDate || '')
        )
      case 'completed':
        return tasks.filter((t) => t.status === 'completed')
      default:
        return tasks
    }
  }, [tasks, filter])

  const counts = useMemo(() => ({
    open:      tasks.filter((t) => t.status !== 'completed').length,
    today:     tasks.filter((t) => t.status !== 'completed' && isToday(t.dueDate)).length,
    overdue:   tasks.filter((t) => t.status !== 'completed' && isOverdue(t.dueDate)).length,
    upcoming:  tasks.filter((t) => t.status !== 'completed' && isUpcoming(t.dueDate)).length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  }), [tasks])

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
    } catch (err) {
      console.warn('Toggle failed:', err)
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: task.status } : t))
    }
  }

  const handleDelete = async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    try {
      await deleteTask(id)
    } catch (err) {
      console.warn('Delete failed:', err)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Tasks</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {counts.open} open
            {counts.overdue > 0 && ` · ${counts.overdue} overdue`}
          </p>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="btn-primary flex items-center justify-center gap-2 sm:px-4 p-2"
          title="Add Task"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Task</span>
        </button>
      </div>

      {showAdd && (
        <AddTaskForm
          contacts={contacts}
          onAdd={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
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

      {/* Task list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-600 text-sm">Loading tasks...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <CheckSquare size={28} className="text-gray-700 mb-2" />
            <p className="text-sm text-gray-500">
              {filter === 'completed' ? 'No completed tasks yet' :
               filter === 'overdue'   ? 'No overdue tasks' :
               filter === 'today'     ? 'Nothing due today' :
               filter === 'upcoming'  ? 'No upcoming tasks' :
                                        "No open tasks — you're all caught up!"}
            </p>
            {filter === 'open' && (
              <button
                onClick={() => setShowAdd(true)}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300"
              >
                Add your first task
              </button>
            )}
          </div>
        ) : (
          filtered.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
