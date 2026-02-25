import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getContact, updateContact, deleteContact } from '@/lib/firebase/contacts'
import { refreshContacts } from '@/hooks/useContacts'
import ContactHeader from '@/components/contacts/ContactHeader'
import ContactTimeline from '@/components/contacts/ContactTimeline'
import ContactForm from '@/components/contacts/ContactForm'
import { ArrowLeft, Phone, MapPin, Calendar, Clock, BookOpen, GraduationCap } from 'lucide-react'

const Field = ({ label, value }) => {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-200">{value}</dd>
    </div>
  )
}

const formatDate = (dateStr) => {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contact, setContact] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)

  useEffect(() => {
    getContact(id).then((c) => {
      setContact(c)
      setLoading(false)
    })
  }, [id])

  const handleSave = async (data) => {
    await updateContact(id, data)
    setContact((c) => ({ ...c, ...data }))
    refreshContacts()
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${contact.firstName} ${contact.lastName}? This cannot be undone.`)) return
    await deleteContact(id)
    refreshContacts()
    navigate('/contacts')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-gray-400">Contact not found.</p>
        <button onClick={() => navigate('/contacts')} className="mt-3 btn-secondary text-sm">
          Back to Contacts
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => navigate('/contacts')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-5 transition-colors"
      >
        <ArrowLeft size={15} /> Back to Contacts
      </button>

      <ContactHeader contact={contact} onEdit={() => setShowEdit(true)} onDelete={handleDelete} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Properties panel */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Details</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Stage" value={contact.stage} />
              <Field label="Status" value={contact.status} />
              <Field label="Relationship" value={contact.relationship} />
              <Field label="Follow-up Interval" value={contact.interval} />
              <Field label="Next Follow Up" value={formatDate(contact.nextFollowUp)} />
              <Field label="Last Communication" value={formatDate(contact.lastCommunication)} />
              <Field label="Office Phone" value={contact.officePhone} />
              <Field label="Mobile Phone" value={contact.mobilePhone} />
              <Field label="Location" value={contact.location} />
              <Field label="Birthday" value={contact.birthdate ? new Date(contact.birthdate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null} />
              <Field label="University" value={contact.university} />
            </dl>
          </div>

          {contact.address && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <MapPin size={14} /> Address
              </h3>
              <p className="text-sm text-gray-300">{contact.address}</p>
            </div>
          )}

          {contact.clientNotes && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <BookOpen size={14} /> Client Notes
              </h3>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{contact.clientNotes}</p>
            </div>
          )}
        </div>

        {/* Activity sidebar */}
        <div>
          <ContactTimeline contact={contact} />
        </div>
      </div>

      {showEdit && (
        <ContactForm
          contact={contact}
          onClose={() => setShowEdit(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
