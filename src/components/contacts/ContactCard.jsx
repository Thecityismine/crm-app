import { useNavigate } from 'react-router-dom'
import Avatar from '@/components/ui/Avatar'
import HealthScoreBadge from '@/components/ui/HealthScoreBadge'
import { getHealthScore } from '@/lib/healthScore'
import { Phone, Calendar, MapPin, Mail } from 'lucide-react'

// Left border color per health score (full class strings for Tailwind JIT)
const BORDER_CLASS = {
  green:  'border-l-2 border-l-green-500',
  yellow: 'border-l-2 border-l-yellow-500',
  orange: 'border-l-2 border-l-orange-500',
  red:    'border-l-2 border-l-red-500',
  gray:   'border-l-2 border-l-gray-700',
}

const DOT_CLASS = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  red:    'bg-red-500',
  gray:   'bg-gray-700',
}

const formatFollowUp = (dateStr) => {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const fmtLastContacted = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const days = Math.floor((Date.now() - d) / 86400000)
  if (days === 0) return 'Contacted today'
  if (days === 1) return 'Contacted yesterday'
  if (days < 7) return `Contacted ${days}d ago`
  if (days < 30) return `Contacted ${Math.floor(days / 7)}w ago`
  return `Contacted ${Math.floor(days / 30)}mo ago`
}

// ── Grid card ──────────────────────────────────────────────────────────────
export default function ContactCard({ contact }) {
  const navigate = useNavigate()
  const health = getHealthScore(contact)
  const isOverdue = contact.nextFollowUp && new Date(contact.nextFollowUp) < new Date()
  const followUpStr = formatFollowUp(contact.nextFollowUp)
  const lastContacted = fmtLastContacted(contact.lastCommunication)

  return (
    <div
      className={`card p-4 cursor-pointer hover:border-gray-700 hover:bg-gray-800/50 transition-all ${BORDER_CLASS[health.color]}`}
      onClick={() => navigate(`/contacts/${contact.id}`)}
    >
      <div className="flex items-start gap-3 mb-3">
        <Avatar
          firstName={contact.firstName}
          lastName={contact.lastName}
          src={contact.photoUrl}
          linkedin={contact.linkedin}
        />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-100 truncate">
            {contact.firstName} {contact.lastName}
          </div>
          {contact.title && (
            <div className="text-xs text-gray-400 truncate">{contact.title}</div>
          )}
          {contact.company && (
            <div className="text-xs text-gray-500 truncate">{contact.company}</div>
          )}
        </div>
        <div className="flex-shrink-0">
          {health.score !== 'unknown' && <HealthScoreBadge contact={contact} />}
        </div>
      </div>

      <div className="space-y-1.5">
        {contact.email && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Mail size={11} className="flex-shrink-0 text-gray-600" />
            <span className="truncate">{contact.email}</span>
          </div>
        )}
        {(contact.mobilePhone || contact.officePhone) && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Phone size={11} className="flex-shrink-0 text-gray-600" />
            {contact.mobilePhone || contact.officePhone}
          </div>
        )}
        {contact.location && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <MapPin size={11} className="flex-shrink-0 text-gray-600" />
            {contact.location}
          </div>
        )}
        {followUpStr ? (
          <div className={`flex items-center gap-2 text-xs ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
            <Calendar size={11} className="flex-shrink-0" />
            {isOverdue ? 'Overdue: ' : 'Follow up: '}{followUpStr}
          </div>
        ) : lastContacted ? (
          <div className="text-xs text-gray-600">{lastContacted}</div>
        ) : null}
      </div>
    </div>
  )
}

// ── List row ───────────────────────────────────────────────────────────────
export function ContactListRow({ contact }) {
  const navigate = useNavigate()
  const health = getHealthScore(contact)
  const isOverdue = contact.nextFollowUp && new Date(contact.nextFollowUp) < new Date()
  const followUpStr = formatFollowUp(contact.nextFollowUp)
  const lastContacted = fmtLastContacted(contact.lastCommunication)

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60 last:border-0 cursor-pointer hover:bg-gray-800/40 transition-colors"
      onClick={() => navigate(`/contacts/${contact.id}`)}
    >
      {/* Health dot */}
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_CLASS[health.color]}`} />

      {/* Avatar */}
      <Avatar
        firstName={contact.firstName}
        lastName={contact.lastName}
        size="sm"
        src={contact.photoUrl}
        linkedin={contact.linkedin}
      />

      {/* Name / Title / Company */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-200 truncate">
          {contact.firstName} {contact.lastName}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {[contact.title, contact.company].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Email — hidden on mobile */}
      <div className="hidden sm:block w-44 min-w-0">
        <p className="text-xs text-gray-500 truncate">{contact.email || '—'}</p>
      </div>

      {/* Location — hidden on small screens */}
      <div className="hidden md:block w-32 min-w-0">
        <p className="text-xs text-gray-500 truncate">{contact.location || '—'}</p>
      </div>

      {/* Health badge */}
      <div className="hidden sm:block w-20 flex-shrink-0 text-right">
        {health.score !== 'unknown' ? <HealthScoreBadge contact={contact} /> : <span className="text-xs text-gray-700">—</span>}
      </div>

      {/* Follow-up / Last contacted */}
      <div className="w-28 text-right flex-shrink-0">
        {followUpStr ? (
          <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-gray-500'}`}>
            {isOverdue ? '⚠ ' : ''}{followUpStr}
          </span>
        ) : lastContacted ? (
          <span className="text-xs text-gray-600">{lastContacted}</span>
        ) : (
          <span className="text-xs text-gray-700">—</span>
        )}
      </div>
    </div>
  )
}
