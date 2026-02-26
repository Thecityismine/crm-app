import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { Mail, Phone, MapPin, Linkedin, Globe, Edit2, Trash2 } from 'lucide-react'

export default function ContactHeader({ contact, onEdit, onDelete }) {
  return (
    <div className="card p-6 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar
            firstName={contact.firstName}
            lastName={contact.lastName}
            size="xl"
            src={contact.photoUrl}
            linkedin={contact.linkedin}
          />
          <div>
            <h1 className="text-2xl font-bold text-gray-100">
              {contact.firstName} {contact.lastName}
            </h1>
            {contact.title && (
              <p className="text-gray-400 mt-0.5">{contact.title}</p>
            )}
            {contact.company && (
              <p className="text-gray-500 text-sm mt-0.5">{contact.company}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {contact.relationship && <Badge label={contact.relationship} />}
            </div>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-800">
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 truncate">
            <Mail size={14} className="text-gray-600 flex-shrink-0" />
            <span className="truncate">{contact.email}</span>
          </a>
        )}
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
          <a href={contact.linkedin.startsWith('http') ? contact.linkedin : `https://${contact.linkedin}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 truncate"
          >
            <Linkedin size={14} className="text-gray-600 flex-shrink-0" />
            <span className="truncate">LinkedIn</span>
          </a>
        )}
        {contact.website && (
          <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
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
