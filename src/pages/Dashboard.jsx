import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '@/hooks/useContacts'
import { useContactStore } from '@/store/contactStore'
import { updateContact } from '@/lib/firebase/contacts'
import { logActivity } from '@/lib/firebase/activities'
import { refreshContacts } from '@/hooks/useContacts'
import { getTasks, updateTask } from '@/lib/firebase/tasks'
import { getHealthScore, getNeedsAttention } from '@/lib/healthScore'
import Avatar from '@/components/ui/Avatar'
import HealthScoreBadge from '@/components/ui/HealthScoreBadge'
import LogActivityModal from '@/components/activities/LogActivityModal'
import { Cake, AlertTriangle, Phone, Mail, Users, CheckSquare, ArrowRight } from 'lucide-react'

// Compute upcoming birthdays within the next N days
const getUpcomingBirthdays = (contacts, daysAhead = 30) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return contacts
    .map((c) => {
      let nextBday = null

      if (c.nextBirthday) {
        nextBday = new Date(c.nextBirthday + 'T12:00:00')
      } else if (c.birthdate) {
        const birth = new Date(c.birthdate + 'T12:00:00')
        if (!isNaN(birth.getTime())) {
          nextBday = new Date(birth)
          nextBday.setFullYear(today.getFullYear())
          if (nextBday < today) nextBday.setFullYear(today.getFullYear() + 1)
        }
      }

      if (!nextBday || isNaN(nextBday.getTime())) return null
      const daysUntil = Math.round((nextBday - today) / (1000 * 60 * 60 * 24))
      if (daysUntil < 0 || daysUntil > daysAhead) return null
      return { ...c, nextBday, daysUntil }
    })
    .filter(Boolean)
    .sort((a, b) => a.daysUntil - b.daysUntil)
}

function BirthdayCard({ contact }) {
  const navigate = useNavigate()
  const label =
    contact.daysUntil === 0 ? '🎂 Today!' :
    contact.daysUntil === 1 ? 'Tomorrow' :
    `In ${contact.daysUntil} days`
  const isUrgent = contact.daysUntil <= 3

  return (
    <div
      className="flex items-center gap-3 py-3 cursor-pointer hover:bg-gray-800/50 px-3 -mx-3 rounded-lg transition-colors"
      onClick={() => navigate(`/contacts/${contact.id}`)}
    >
      <Avatar firstName={contact.firstName} lastName={contact.lastName} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">{contact.firstName} {contact.lastName}</p>
        {contact.company && <p className="text-xs text-gray-500 truncate">{contact.company}</p>}
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ${isUrgent ? 'text-amber-400' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  )
}

function NeedsAttentionRow({ contact, onLog }) {
  const navigate = useNavigate()
  const health = getHealthScore(contact)

  const overdueLabel = () => {
    const d = Math.abs(contact._health?.daysOverdue ?? health.daysOverdue)
    if (health.score === 'due_soon') return d === 0 ? 'Due today' : `Due in ${d}d`
    return `${d}d overdue`
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-800/60 last:border-0">
      <div
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        onClick={() => navigate(`/contacts/${contact.id}`)}
      >
        <Avatar firstName={contact.firstName} lastName={contact.lastName} size="sm"
          src={contact.photoUrl} linkedin={contact.linkedin} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-200 truncate">{contact.firstName} {contact.lastName}</p>
          {contact.company && <p className="text-xs text-gray-500 truncate">{contact.company}</p>}
        </div>
      </div>
      <HealthScoreBadge contact={contact} />
      <span className="text-xs text-gray-500 w-20 text-right flex-shrink-0">{overdueLabel()}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onLog(contact) }}
        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/50 px-2 py-1 rounded-lg transition-colors flex-shrink-0"
      >
        <Phone size={11} /> Log
      </button>
    </div>
  )
}

const isTaskToday = (dateStr) => {
  if (!dateStr) return false
  const d = new Date(dateStr + 'T12:00:00')
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const end = new Date(t); end.setDate(end.getDate() + 1)
  return d >= t && d < end
}
const isTaskOverdue = (dateStr) => {
  if (!dateStr) return false
  const d = new Date(dateStr + 'T12:00:00')
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return d < t
}

export default function Dashboard() {
  const { contacts } = useContacts()
  const { updateContact: updateStoreContact } = useContactStore()
  const upcoming = getUpcomingBirthdays(contacts, 30)
  const needsAttention = getNeedsAttention(contacts).slice(0, 10)

  const [loggingContact, setLoggingContact] = useState(null)
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    getTasks().then(setTasks).catch(console.warn)
  }, [])

  const COMMUNICATION_TYPES = new Set(['call', 'email', 'meeting', 'sms'])

  const handleLogSave = async (data) => {
    await logActivity(loggingContact.id, data)
    if (COMMUNICATION_TYPES.has(data.type)) {
      await updateContact(loggingContact.id, { lastCommunication: data.occurredAt })
      useContactStore.getState().updateContact(loggingContact.id, { lastCommunication: data.occurredAt })
    }
    refreshContacts()
    setLoggingContact(null)
  }

  // Counts
  const overdueCount = contacts.filter((c) => c.nextFollowUp && new Date(c.nextFollowUp) < new Date()).length
  const coldCount = contacts.filter((c) => ['cold', 'overdue'].includes(getHealthScore(c).score)).length
  const openTasks = tasks.filter((t) => t.status !== 'completed')
  const urgentTasks = openTasks.filter((t) => isTaskOverdue(t.dueDate) || isTaskToday(t.dueDate)).slice(0, 5)

  const handleCompleteTask = async (task) => {
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: 'completed' } : t))
    try { await updateTask(task.id, { status: 'completed' }) } catch { /* silent */ }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-100 mb-1">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-6">
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Total Contacts</p>
          <p className="text-2xl font-bold text-gray-100">{contacts.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Open Tasks</p>
          <p className={`text-2xl font-bold ${openTasks.filter(t => isTaskOverdue(t.dueDate)).length > 0 ? 'text-red-400' : 'text-gray-100'}`}>
            {openTasks.length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Overdue Follow-ups</p>
          <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-orange-400' : 'text-gray-100'}`}>{overdueCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Need Attention</p>
          <p className={`text-2xl font-bold ${coldCount > 0 ? 'text-red-400' : 'text-gray-100'}`}>{coldCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Needs Attention — full left 2 cols */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={15} className="text-orange-400" />
            <h2 className="text-sm font-semibold text-gray-300">Needs Attention</h2>
            <span className="ml-auto text-xs text-gray-600">{needsAttention.length} contacts</span>
          </div>

          {needsAttention.length > 0 ? (
            <div>
              {needsAttention.map((c) => (
                <NeedsAttentionRow key={c.id} contact={c} onLog={setLoggingContact} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <Users size={28} className="text-gray-700 mb-2" />
              <p className="text-sm text-gray-500">All relationships are on track</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Upcoming Birthdays */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Cake size={15} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-gray-300">Upcoming Birthdays</h2>
              <span className="ml-auto text-xs text-gray-600">30 days</span>
            </div>
            {upcoming.length > 0 ? (
              <div className="divide-y divide-gray-800/50">
                {upcoming.map((c) => <BirthdayCard key={c.id} contact={c} />)}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <Cake size={24} className="text-gray-700 mb-2" />
                <p className="text-sm text-gray-500">None in the next 30 days</p>
              </div>
            )}
          </div>

          {/* Tasks due today / overdue */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckSquare size={15} className="text-blue-400" />
              <h2 className="text-sm font-semibold text-gray-300">Tasks</h2>
              <a href="/tasks" className="ml-auto flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors">
                View all <ArrowRight size={11} />
              </a>
            </div>
            {urgentTasks.length > 0 ? (
              <div className="space-y-2">
                {urgentTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 py-1">
                    <button
                      onClick={() => handleCompleteTask(t)}
                      className="flex-shrink-0 w-4 h-4 rounded border border-gray-600 hover:border-gray-400 transition-colors bg-transparent"
                      style={{ minWidth: 16, minHeight: 16 }}
                    />
                    <span className={`text-xs flex-1 truncate ${isTaskOverdue(t.dueDate) ? 'text-red-300' : 'text-gray-300'}`}>
                      {t.title}
                    </span>
                    <span className={`text-xs flex-shrink-0 ${isTaskOverdue(t.dueDate) ? 'text-red-500' : 'text-amber-400'}`}>
                      {isTaskOverdue(t.dueDate) ? 'Overdue' : 'Today'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No urgent tasks</p>
            )}
          </div>
        </div>
      </div>

      {loggingContact && (
        <LogActivityModal
          onClose={() => setLoggingContact(null)}
          onSave={handleLogSave}
        />
      )}
    </div>
  )
}
