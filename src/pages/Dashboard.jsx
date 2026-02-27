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
import { auth } from '@/config/firebase'
import Avatar from '@/components/ui/Avatar'
import HealthScoreBadge from '@/components/ui/HealthScoreBadge'
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

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const ACTIVITY_META = {
  call:    { label: 'Call',    Icon: Phone,         color: 'text-green-400' },
  email:   { label: 'Email',   Icon: Mail,          color: 'text-blue-400' },
  meeting: { label: 'Meeting', Icon: Users,         color: 'text-purple-400' },
  note:    { label: 'Note',    Icon: FileText,      color: 'text-yellow-400' },
  sms:     { label: 'SMS',     Icon: MessageSquare, color: 'text-teal-400' },
}

const OPEN_STAGES = new Set(['Lead', 'Qualified', 'Proposal', 'Negotiation'])

// ── sub-components ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'text-gray-100', icon: Icon, iconColor }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs text-gray-500">{label}</p>
        {Icon && <Icon size={14} className={iconColor || 'text-gray-600'} />}
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
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
  const health = getHealthScore(contact)
  const overdueLabel = () => {
    const d = Math.abs(contact._health?.daysOverdue ?? health.daysOverdue)
    if (health.score === 'due_soon') return d === 0 ? 'Due today' : `Due in ${d}d`
    return `${d}d overdue`
  }
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-800/60 last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/contacts/${contact.id}`)}>
        <Avatar firstName={contact.firstName} lastName={contact.lastName} size="sm" src={contact.photoUrl} linkedin={contact.linkedin} />
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

// ── main ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const { contacts } = useContacts()
  const upcoming = getUpcomingBirthdays(contacts, 30)
  const needsAttention = getNeedsAttention(contacts).slice(0, 8)

  const [loggingContact, setLoggingContact] = useState(null)
  const [tasks, setTasks] = useState([])
  const [deals, setDeals] = useState([])
  const [recentActivities, setRecentActivities] = useState([])

  useEffect(() => {
    getTasks().then(setTasks).catch(console.warn)
    getDeals().then(setDeals).catch(console.warn)
    getRecentActivities(8).then(setRecentActivities).catch(console.warn)
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

  // Computed
  const openTasks = tasks.filter((t) => t.status !== 'completed')
  const tasksDueToday = openTasks.filter((t) => isTaskOverdue(t.dueDate) || isTaskToday(t.dueDate))
  const openDeals = deals.filter((d) => OPEN_STAGES.has(d.stage))
  const pipelineValue = openDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
  const coldCount = contacts.filter((c) => ['cold', 'overdue'].includes(getHealthScore(c).score)).length

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

  const firstName = auth.currentUser?.displayName?.split(' ')[0] || ''

  return (
    <div>
      {/* Greeting */}
      <h1 className="text-2xl font-semibold text-gray-100 mb-0.5">
        {getGreeting()}{firstName ? `, ${firstName}` : ''} — here's your day
      </h1>
      <p className="text-gray-500 text-sm mb-6">
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total Contacts"
          value={contacts.length}
          icon={Users}
          iconColor="text-gray-600"
        />
        <StatCard
          label="Open Deals"
          value={openDeals.length}
          sub={pipelineValue > 0 ? `${fmtCurrency(pipelineValue)} pipeline` : undefined}
          icon={Briefcase}
          iconColor={openDeals.length > 0 ? 'text-blue-500' : 'text-gray-600'}
          color={openDeals.length > 0 ? 'text-blue-400' : 'text-gray-100'}
        />
        <StatCard
          label="Tasks Due Today"
          value={tasksDueToday.length}
          icon={CheckSquare}
          iconColor={tasksDueToday.length > 0 ? 'text-amber-400' : 'text-gray-600'}
          color={tasksDueToday.length > 0 ? 'text-amber-400' : 'text-gray-100'}
        />
        <StatCard
          label="Need Attention"
          value={coldCount}
          icon={AlertTriangle}
          iconColor={coldCount > 0 ? 'text-orange-400' : 'text-gray-600'}
          color={coldCount > 0 ? 'text-orange-400' : 'text-gray-100'}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Needs Attention — 2 cols */}
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
              <p className="text-sm text-gray-500 text-center py-4">No open tasks</p>
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
              <p className="text-sm text-gray-500">No open deals</p>
              <button
                onClick={() => navigate('/deals')}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Add a deal
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
