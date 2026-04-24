import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '@/hooks/useContacts'
import { useContactStore } from '@/store/contactStore'
import { updateContact } from '@/lib/firebase/contacts'
import { logActivity, getRecentActivities } from '@/lib/firebase/activities'
import { refreshContacts } from '@/hooks/useContacts'
import { getTasks, updateTask } from '@/lib/firebase/tasks'
import { getDeals } from '@/lib/firebase/deals'
import { getHealthScore, getNeedsAttention } from '@/lib/healthScore'
import Avatar from '@/components/ui/Avatar'
import LogActivityModal from '@/components/activities/LogActivityModal'
import {
  Cake, AlertTriangle, Phone, Users, CheckSquare, ArrowRight,
  Briefcase, TrendingUp, Activity, UserPlus, Mail, FileText, MessageSquare,
} from 'lucide-react'

// ── helpers ────────────────────────────────────────────────────────────────
const getUpcomingBirthdays = (contacts, daysAhead = 30) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return contacts.map((c) => {
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
  }).filter(Boolean).sort((a, b) => a.daysUntil - b.daysUntil)
}

const parseDueDate = (dateStr) => {
  const [y, m, day] = dateStr.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, day)
}

const isTaskToday = (dateStr) => {
  if (!dateStr) return false
  const d = parseDueDate(dateStr)
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return d.getTime() === t.getTime()
}

const isTaskOverdue = (dateStr) => {
  if (!dateStr) return false
  const d = parseDueDate(dateStr)
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return d < t
}

const fmtCurrency = (n) => {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

const fmtRelative = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const diff = Math.floor((Date.now() - d) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const ACTIVITY_META = {
  call:    { label: 'Call',    Icon: Phone,         color: 'text-green-400' },
  email:   { label: 'Email',   Icon: Mail,          color: 'text-blue-400' },
  meeting: { label: 'Meeting', Icon: Users,         color: 'text-purple-400' },
  note:    { label: 'Note',    Icon: FileText,      color: 'text-yellow-400' },
  sms:     { label: 'SMS',     Icon: MessageSquare, color: 'text-teal-400' },
}

const OPEN_STAGES = new Set(['Lead', 'Qualified', 'Proposal', 'Negotiation'])

function getPriority(score) {
  if (score === 'cold')     return { label: 'High', className: 'text-red-400 bg-red-400/10 border border-red-400/20' }
  if (score === 'overdue')  return { label: 'Med',  className: 'text-orange-400 bg-orange-400/10 border border-orange-400/20' }
  return                           { label: 'Low',  className: 'text-yellow-500 bg-yellow-500/10 border border-yellow-500/20' }
}

function getAttentionReason(contact) {
  const health = contact._health || getHealthScore(contact)
  if (contact.lastCommunication) {
    const days = Math.round((Date.now() - new Date(contact.lastCommunication)) / 86400000)
    if (days >= 0) return `No contact in ${days}d`
  }
  if (health.daysOverdue > 0) return `${health.daysOverdue}d overdue`
  if (health.score === 'due_soon') return 'Follow-up due soon'
  return 'Needs attention'
}

// ── sub-components ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'text-gray-100', subColor, icon: Icon, iconColor }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs text-gray-500">{label}</p>
        {Icon && <Icon size={14} className={iconColor || 'text-gray-600'} />}
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${subColor || 'text-gray-600'}`}>{sub}</p>}
    </div>
  )
}

function BirthdayCard({ contact }) {
  const navigate = useNavigate()
  const label = contact.daysUntil === 0 ? '🎂 Today!' : contact.daysUntil === 1 ? 'Tomorrow' : `In ${contact.daysUntil}d`
  return (
    <div
      className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-gray-800/50 px-3 -mx-3 rounded-lg transition-colors"
      onClick={() => navigate(`/contacts/${contact.id}`)}
    >
      <Avatar firstName={contact.firstName} lastName={contact.lastName} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">{contact.firstName} {contact.lastName}</p>
        {contact.company && <p className="text-xs text-gray-500 truncate">{contact.company}</p>}
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ${contact.daysUntil <= 3 ? 'text-amber-400' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  )
}

function NeedsAttentionRow({ contact, onLog }) {
  const navigate = useNavigate()
  const health = contact._health || getHealthScore(contact)
  const priority = getPriority(health.score)
  const reason = getAttentionReason(contact)

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-800/60 last:border-0">
      <div
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        onClick={() => navigate(`/contacts/${contact.id}`)}
      >
        <Avatar firstName={contact.firstName} lastName={contact.lastName} size="sm" src={contact.photoUrl} linkedin={contact.linkedin} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm text-gray-200 truncate">{contact.firstName} {contact.lastName}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 ${priority.className}`}>
              {priority.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {reason}{contact.company ? ` · ${contact.company}` : ''}
          </p>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onLog(contact) }}
        className="flex items-center gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 shadow-sm"
      >
        <Phone size={11} /> Log
      </button>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const { contacts } = useContacts()
  const upcoming = getUpcomingBirthdays(contacts, 30)

  const allNeedsAttention = getNeedsAttention(contacts)
  const needsAttention = allNeedsAttention.slice(0, 8)
  const highPriorityCount = allNeedsAttention.filter(c => c._health.score === 'cold').length

  const [loggingContact, setLoggingContact] = useState(null)
  const [tasks, setTasks] = useState([])
  const [deals, setDeals] = useState([])
  const [recentActivities, setRecentActivities] = useState([])

  useEffect(() => {
    getTasks().then(setTasks).catch(console.warn)
    getDeals().then(setDeals).catch(console.warn)
    getRecentActivities(8).then(setRecentActivities).catch(console.warn)
  }, [])

  const COMMUNICATION_TYPES = new Set(['call', 'email', 'meeting', 'sms', 'note'])

  const handleLogSave = async (data) => {
    await logActivity(loggingContact.id, data)
    if (COMMUNICATION_TYPES.has(data.type)) {
      await updateContact(loggingContact.id, { lastCommunication: data.occurredAt })
      useContactStore.getState().updateContact(loggingContact.id, { lastCommunication: data.occurredAt })
    }
    refreshContacts()
    setLoggingContact(null)
  }

  // Computed
  const openTasks = tasks.filter((t) => t.status !== 'completed')
  const tasksDueToday = openTasks.filter((t) => isTaskOverdue(t.dueDate) || isTaskToday(t.dueDate))
  const overdueTasksCount = openTasks.filter((t) => isTaskOverdue(t.dueDate)).length
  const openDeals = deals.filter((d) => OPEN_STAGES.has(d.stage))
  const pipelineValue = openDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0)

  const newThisMonth = contacts.filter(c => {
    if (!c.createdAt) return false
    const d = new Date(c.createdAt), now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const displayTasks = [...openTasks].sort((a, b) => {
    const aOver = isTaskOverdue(a.dueDate), bOver = isTaskOverdue(b.dueDate)
    const aToday = isTaskToday(a.dueDate), bToday = isTaskToday(b.dueDate)
    if (aOver !== bOver) return aOver ? -1 : 1
    if (aToday !== bToday) return aToday ? -1 : 1
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  }).slice(0, 5)

  const stageOrder = ['Lead', 'Qualified', 'Proposal', 'Negotiation']
  const dealsByStage = stageOrder
    .map((stage) => {
      const stageDeals = openDeals.filter((d) => d.stage === stage)
      return { stage, count: stageDeals.length, value: stageDeals.reduce((s, d) => s + (Number(d.value) || 0), 0) }
    })
    .filter((s) => s.count > 0)

  const recentContacts = [...contacts]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 5)

  const handleCompleteTask = async (task) => {
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: 'completed' } : t))
    try { await updateTask(task.id, { status: 'completed' }) } catch { /* silent */ }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-100 mb-0.5">Command Center</h1>
        <p className="text-gray-400 text-sm font-medium">Your daily CRM priorities</p>
        <p className="text-gray-600 text-xs mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Intelligence insight banner */}
      {allNeedsAttention.length >= 3 && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-orange-500/5 border border-orange-500/15 rounded-xl">
          <TrendingUp size={14} className="text-orange-400 flex-shrink-0" />
          <p className="text-xs text-gray-400 flex-1">
            <span className="text-orange-300 font-medium">{allNeedsAttention.length} contacts</span> haven't been reached recently — prioritize outreach to keep relationships warm.
          </p>
          <button
            onClick={() => document.getElementById('needs-attention')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-xs text-orange-400 hover:text-orange-300 flex-shrink-0 transition-colors font-medium"
          >
            Review →
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total Contacts"
          value={contacts.length}
          sub={newThisMonth > 0 ? `+${newThisMonth} this month` : undefined}
          icon={Users}
          iconColor="text-gray-600"
        />
        <StatCard
          label="Open Deals"
          value={openDeals.length}
          sub={pipelineValue > 0 ? `${fmtCurrency(pipelineValue)} pipeline` : openDeals.length === 0 ? 'No pipeline yet' : undefined}
          icon={Briefcase}
          iconColor={openDeals.length > 0 ? 'text-blue-500' : 'text-gray-600'}
          color={openDeals.length > 0 ? 'text-blue-400' : 'text-gray-100'}
        />
        <StatCard
          label="Tasks Due Today"
          value={tasksDueToday.length}
          sub={overdueTasksCount > 0 ? `${overdueTasksCount} overdue` : tasksDueToday.length > 0 ? 'Due today' : 'All caught up'}
          subColor={overdueTasksCount > 0 ? 'text-red-500' : undefined}
          icon={CheckSquare}
          iconColor={tasksDueToday.length > 0 ? 'text-amber-400' : 'text-gray-600'}
          color={tasksDueToday.length > 0 ? 'text-amber-400' : 'text-gray-100'}
        />
        <StatCard
          label="Need Attention"
          value={allNeedsAttention.length}
          sub={highPriorityCount > 0 ? `${highPriorityCount} high priority` : allNeedsAttention.length > 0 ? 'Follow up needed' : 'All on track'}
          subColor={highPriorityCount > 0 ? 'text-red-400' : undefined}
          icon={AlertTriangle}
          iconColor={allNeedsAttention.length > 0 ? 'text-orange-400' : 'text-gray-600'}
          color={allNeedsAttention.length > 0 ? 'text-orange-400' : 'text-gray-100'}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Needs Attention — hero section */}
        <div
          id="needs-attention"
          className={`lg:col-span-2 card p-5 ${needsAttention.length > 0 ? 'border-orange-500/20' : ''}`}
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={15} className="text-orange-400" />
            <h2 className="text-sm font-semibold text-gray-300">Needs Attention</h2>
            {highPriorityCount > 0 && (
              <span className="text-[10px] font-semibold text-red-400 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded-md">
                {highPriorityCount} high
              </span>
            )}
            <span className="ml-auto text-xs text-gray-600">{allNeedsAttention.length} contacts</span>
          </div>
          {needsAttention.length > 0 ? (
            <div>
              {needsAttention.map((c) => (
                <NeedsAttentionRow key={c.id} contact={c} onLog={setLoggingContact} />
              ))}
              {allNeedsAttention.length > 8 && (
                <button
                  onClick={() => navigate('/contacts')}
                  className="mt-3 w-full text-xs text-gray-500 hover:text-gray-400 transition-colors text-center py-1"
                >
                  +{allNeedsAttention.length - 8} more · View all →
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <Users size={28} className="text-gray-700 mb-2" />
              <p className="text-sm text-gray-500">All relationships are on track</p>
            </div>
          )}
        </div>

        {/* Right column: Tasks + Birthdays */}
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckSquare size={15} className="text-blue-400" />
              <h2 className="text-sm font-semibold text-gray-300">Tasks</h2>
              <button
                onClick={() => navigate('/tasks')}
                className="ml-auto flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                View all <ArrowRight size={11} />
              </button>
            </div>
            {displayTasks.length > 0 ? (
              <div className="space-y-2">
                {displayTasks.map((t) => {
                  const overdue = isTaskOverdue(t.dueDate)
                  const today = isTaskToday(t.dueDate)
                  const dateLabel = overdue ? 'Overdue' : today ? 'Today' : t.dueDate
                    ? new Date(t.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : ''
                  return (
                    <div key={t.id} className="flex items-center gap-2.5 py-1">
                      <button
                        onClick={() => handleCompleteTask(t)}
                        className="flex-shrink-0 w-4 h-4 rounded border border-gray-600 hover:border-gray-400 transition-colors bg-transparent"
                        style={{ minWidth: 16, minHeight: 16 }}
                      />
                      <span className={`text-xs flex-1 truncate ${overdue ? 'text-red-300' : 'text-gray-300'}`}>
                        {t.title}
                      </span>
                      {dateLabel && (
                        <span className={`text-xs flex-shrink-0 ${overdue ? 'text-red-500' : today ? 'text-amber-400' : 'text-gray-500'}`}>
                          {dateLabel}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-4 text-center">
                <CheckSquare size={24} className="text-gray-700 mb-2" />
                <p className="text-sm text-gray-500">No open tasks</p>
                <button
                  onClick={() => navigate('/tasks')}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Create a task →
                </button>
              </div>
            )}
          </div>

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
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Pipeline Summary */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-gray-300">Pipeline</h2>
            <button
              onClick={() => navigate('/deals')}
              className="ml-auto flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              View all <ArrowRight size={11} />
            </button>
          </div>
          {dealsByStage.length > 0 ? (
            <div className="space-y-3">
              {dealsByStage.map(({ stage, count, value }) => (
                <div key={stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">{stage}</span>
                    <span className="text-xs text-gray-500">
                      {count} deal{count !== 1 ? 's' : ''}{value > 0 ? ` · ${fmtCurrency(value)}` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(100, (count / Math.max(1, openDeals.length)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-800 flex justify-between text-xs">
                <span className="text-gray-500">{openDeals.length} open deal{openDeals.length !== 1 ? 's' : ''}</span>
                <span className="text-gray-400 font-medium">{fmtCurrency(pipelineValue)} total</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <Briefcase size={24} className="text-gray-700 mb-2" />
              <p className="text-sm text-gray-500">No open deals yet</p>
              <button
                onClick={() => navigate('/deals')}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Create your first deal →
              </button>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={15} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-gray-300">Recent Activity</h2>
          </div>
          {recentActivities.length > 0 ? (
            <div className="space-y-1">
              {recentActivities.map((a) => {
                const meta = ACTIVITY_META[a.type] || ACTIVITY_META.note
                const contact = contacts.find((c) => c.id === a.contactId)
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-2.5 px-2 py-2 -mx-2 rounded-lg cursor-pointer hover:bg-gray-800/40 transition-colors"
                    onClick={() => contact && navigate(`/contacts/${contact.id}`)}
                  >
                    <meta.Icon size={13} className={`${meta.color} flex-shrink-0 mt-0.5`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-300 truncate">
                        {contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown'}
                        <span className="text-gray-600"> · {meta.label}</span>
                      </p>
                      {a.note && <p className="text-xs text-gray-600 truncate mt-0.5">{a.note}</p>}
                    </div>
                    <span className="text-xs text-gray-600 flex-shrink-0 whitespace-nowrap">{fmtRelative(a.occurredAt)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <Activity size={24} className="text-gray-700 mb-2" />
              <p className="text-sm text-gray-500">No recent activity</p>
              <button
                onClick={() => navigate('/contacts')}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Log your first interaction →
              </button>
            </div>
          )}
        </div>

        {/* Recently Added Contacts */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={15} className="text-teal-400" />
            <h2 className="text-sm font-semibold text-gray-300">Recently Added</h2>
            <button
              onClick={() => navigate('/contacts')}
              className="ml-auto flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              View all <ArrowRight size={11} />
            </button>
          </div>
          {recentContacts.length > 0 ? (
            <div className="space-y-1">
              {recentContacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2.5 py-2 cursor-pointer hover:bg-gray-800/50 px-3 -mx-3 rounded-lg transition-colors"
                  onClick={() => navigate(`/contacts/${c.id}`)}
                >
                  <Avatar firstName={c.firstName} lastName={c.lastName} size="sm" src={c.photoUrl} linkedin={c.linkedin} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-200 truncate">{c.firstName} {c.lastName}</p>
                    {c.company && <p className="text-xs text-gray-500 truncate">{c.company}</p>}
                  </div>
                  <span className="text-xs text-gray-600 flex-shrink-0">{fmtRelative(c.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <Users size={24} className="text-gray-700 mb-2" />
              <p className="text-sm text-gray-500">No contacts yet</p>
              <button
                onClick={() => navigate('/contacts')}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Add your first contact →
              </button>
            </div>
          )}
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
