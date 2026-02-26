import { useNavigate } from 'react-router-dom'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import HealthScoreBadge from '@/components/ui/HealthScoreBadge'
import { Mail, Phone, Calendar, MapPin } from 'lucide-react'

const formatFollowUp = (dateStr) => {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ContactCard({ contact }) {
  const navigate = useNavigate()
  const isOverdue = contact.nextFollowUp && new Date(contact.nextFollowUp) < new Date()
  const followUpStr = formatFollowUp(contact.nextFollowUp)

  return (
    <div
      className="card p-4 cursor-pointer hover:border-gray-700 hover:bg-gray-800/50 transition-all"
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
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {contact.relationship && <Badge label={contact.relationship} />}
          <HealthScoreBadge contact={contact} />
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
        {followUpStr && (
          <div className={`flex items-center gap-2 text-xs ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
            <Calendar size={11} className="flex-shrink-0" />
            {isOverdue ? 'Overdue: ' : 'Follow up: '}{followUpStr}
          </div>
        )}
      </div>
    </div>
  )
}
