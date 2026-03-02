import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import HealthScoreBadge from '@/components/ui/HealthScoreBadge'
import { Mail, Phone, MapPin, Linkedin, Instagram, Globe, Edit2, Trash2 } from 'lucide-react'

export default function ContactHeader({ contact, onEdit, onDelete }) {
  // Collect all emails (new multi-email field or fallback to single email)
  const emails = Array.isArray(contact.emails) && contact.emails.length
    ? contact.emails
    : contact.email ? [contact.email] : []

  return (
    <div className="card p-4 sm:p-6 mb-6">
      {/* Top row: avatar + name + action buttons */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Avatar
            firstName={contact.firstName}
            lastName={contact.lastName}
            size="lg"
            src={contact.photoUrl}
            linkedin={contact.linkedin}
          />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-100 leading-tight">
              {contact.firstName} {contact.lastName}
            </h1>
            {contact.title && (
              <p className="text-sm text-gray-400 mt-0.5 truncate">{contact.title}</p>
            )}
            {contact.company && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{contact.company}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 btn-secondary text-xs px-3 py-1.5"
          >
            <Edit2 size={13} /> Edit
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Badges — own row so they never crowd the name */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {contact.relationship && <Badge label={contact.relationship} />}
        <HealthScoreBadge contact={contact} />
      </div>

      {/* Contact links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-800">
        {emails.map((email, i) => (
          <a
            key={i}
            href={`mailto:${email}`}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 truncate"
          >
            <Mail size={14} className="text-gray-600 flex-shrink-0" />
            <span className="truncate">{email}</span>
          </a>
        ))}
        {contact.mobilePhone && (
          <a href={`tel:${contact.mobilePhone}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200">
            <Phone size={14} className="text-gray-600 flex-shrink-0" />
            {contact.mobilePhone}
          </a>
        )}
        {contact.location && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <MapPin size={14} className="text-gray-600 flex-shrink-0" />
            {contact.location}
          </div>
        )}
        {contact.linkedin && (
          <a
            href={contact.linkedin.startsWith('http') ? contact.linkedin : `https://${contact.linkedin}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 truncate"
          >
            <Linkedin size={14} className="text-gray-600 flex-shrink-0" />
            <span className="truncate">LinkedIn</span>
          </a>
        )}
        {contact.instagram && (
          <a
            href={contact.instagram.startsWith('http') ? contact.instagram : `https://instagram.com/${contact.instagram.replace(/^@/, '')}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 truncate"
          >
            <Instagram size={14} className="text-gray-600 flex-shrink-0" />
            <span className="truncate">Instagram</span>
          </a>
        )}
        {contact.website && (
          <a
            href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 truncate"
          >
            <Globe size={14} className="text-gray-600 flex-shrink-0" />
            <span className="truncate">{contact.website}</span>
          </a>
        )}
      </div>
    </div>
  )
}
