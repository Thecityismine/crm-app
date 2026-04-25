import { useState, useEffect, useCallback } from 'react'
import { Phone, Mail, Users, FileText, MessageSquare, Plus, Loader, X } from 'lucide-react'
import { getActivities, logActivity } from '@/lib/firebase/activities'
import { updateContact } from '@/lib/firebase/contacts'
import LogActivityModal from '@/components/activities/LogActivityModal'

function ImageLightbox({ url, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-300 hover:bg-gray-700 transition-colors"
      >
        <X size={18} />
      </button>
      <img
        src={url}
        alt="attachment"
        className="max-w-full max-h-full rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

const TYPE_META = {
  call:    { label: 'Call',    Icon: Phone,         color: 'text-green-400',  bg: 'bg-green-500/10' },
  email:   { label: 'Email',   Icon: Mail,          color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  meeting: { label: 'Meeting', Icon: Users,         color: 'text-purple-400', bg: 'bg-purple-500/10' },
  note:    { label: 'Note',    Icon: FileText,      color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  sms:     { label: 'SMS',     Icon: MessageSquare, color: 'text-teal-400',   bg: 'bg-teal-500/10' },
}

const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: diffDays > 365 ? 'numeric' : undefined,
  })
}

// Types that update lastCommunication on the contact (notes count — they document an interaction)
const COMMUNICATION_TYPES = new Set(['call', 'email', 'meeting', 'sms', 'note'])

export default function ContactTimeline({ contact, onContactUpdated }) {
  const [activities,   setActivities]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [lightboxUrl,  setLightboxUrl]  = useState(null)

  const load = useCallback(async () => {
    if (!contact?.id) return
    setLoading(true)
    try {
      const data = await getActivities(contact.id)
      setActivities(data)
    } catch (err) {
      console.error('Failed to load activities:', err)
    } finally {
      setLoading(false)
    }
  }, [contact?.id])

  useEffect(() => { load() }, [load])

  const handleSave = async (data) => {
    await logActivity(contact.id, data)

    // Keep lastCommunication on the contact in sync
    if (COMMUNICATION_TYPES.has(data.type)) {
      await updateContact(contact.id, { lastCommunication: data.occurredAt })
      onContactUpdated?.({ lastCommunication: data.occurredAt })
    }

    // Optimistic prepend, then reload to get real server id
    setActivities((prev) => [{ id: '_tmp_' + Date.now(), ...data }, ...prev])
    load()
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300">Activity</h3>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <Plus size={13} /> Log
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader size={16} className="text-gray-600 animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500">No activity yet.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Log the first interaction
          </button>
        </div>
      ) : (
        <ol className="relative border-l border-gray-800 ml-2 space-y-5">
          {activities.map((activity) => {
            const meta = TYPE_META[activity.type] || TYPE_META.note
            const { Icon, color, bg, label } = meta
            return (
              <li key={activity.id} className="ml-4">
                <span className={`absolute -left-[9px] flex items-center justify-center w-[18px] h-[18px] rounded-full ${bg}`}>
                  <Icon size={10} className={color} />
                </span>
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-xs font-medium ${color}`}>{label}</span>
                  <span className="text-xs text-gray-600 flex-shrink-0">{formatDate(activity.occurredAt)}</span>
                </div>
                {activity.notes && (
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">{activity.notes}</p>
                )}
                {activity.imageURL && (
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(activity.imageURL)}
                    className="mt-2 inline-block"
                  >
                    <img
                      src={activity.imageURL}
                      alt="attachment"
                      className="h-24 w-auto rounded-lg object-cover border border-gray-700 hover:border-gray-500 transition-colors"
                    />
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {showModal && (
        <LogActivityModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}

      {lightboxUrl && (
        <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  )
}
