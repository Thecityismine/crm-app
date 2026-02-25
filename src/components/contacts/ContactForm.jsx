import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Avatar, { getLinkedInPhotoUrl } from '@/components/ui/Avatar'
import { useSettingsStore } from '@/store/settingsStore'
import { AlertCircle } from 'lucide-react'

const INTERVALS = ['30 Days', '60 Days', '90 Days', '6 Months', '1 Year']

const emptyForm = {
  firstName: '', lastName: '', company: '', title: '', relationship: '',
  email: '', mobilePhone: '', officePhone: '',
  location: '', address: '', linkedin: '', website: '', interval: '',
  nextFollowUp: '', birthdate: '', clientNotes: '', university: '', photoUrl: '',
}

export default function ContactForm({ contact, onClose, onSave }) {
  const relationshipOptions = useSettingsStore((s) => s.relationshipOptions)
  const [form, setForm] = useState(contact ? {
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    company: contact.company || '',
    title: contact.title || '',
    relationship: contact.relationship || '',
    email: contact.email || '',
    mobilePhone: contact.mobilePhone || '',
    officePhone: contact.officePhone || '',
    location: contact.location || '',
    address: contact.address || '',
    linkedin: contact.linkedin || '',
    website: contact.website || '',
    interval: contact.interval || '',
    nextFollowUp: contact.nextFollowUp ? contact.nextFollowUp.slice(0, 10) : '',
    birthdate: contact.birthdate ? contact.birthdate.slice(0, 10) : '',
    clientNotes: contact.clientNotes || '',
    university: contact.university || '',
    photoUrl: contact.photoUrl || '',
  } : emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const data = {
        ...form,
        nextFollowUp: form.nextFollowUp ? new Date(form.nextFollowUp).toISOString() : null,
      }
      // 15-second timeout guard so the button never gets permanently stuck
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Save timed out — check your connection and try again.')), 15000)
      )
      await Promise.race([onSave(data), timeout])
      onClose()
    } catch (err) {
      console.error('ContactForm save error:', err)
      setSaveError(err?.message ?? 'Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const photoSrc = form.photoUrl || getLinkedInPhotoUrl(form.linkedin)

  // If the contact's current relationship value isn't in the list, append it so it
  // still shows correctly in the dropdown while editing.
  const relationshipList = (contact?.relationship && !relationshipOptions.includes(contact.relationship))
    ? [...relationshipOptions, contact.relationship]
    : relationshipOptions

  return (
    <Modal title={contact ? 'Edit Contact' : 'New Contact'} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo preview */}
        <div className="flex items-center gap-4">
          <Avatar firstName={form.firstName} lastName={form.lastName} size="lg" src={photoSrc} />
          <div className="flex-1">
            <label className="label">Photo URL <span className="text-gray-600 font-normal">(optional override)</span></label>
            <input
              className="input text-xs"
              placeholder="Auto-fetched from LinkedIn — paste URL to override"
              value={form.photoUrl}
              onChange={set('photoUrl')}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First Name *</label>
            <input className="input" value={form.firstName} onChange={set('firstName')} required />
          </div>
          <div>
            <label className="label">Last Name</label>
            <input className="input" value={form.lastName} onChange={set('lastName')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Company</label>
            <input className="input" value={form.company} onChange={set('company')} />
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={set('title')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Relationship</label>
            <select className="input" value={form.relationship} onChange={set('relationship')}>
              <option value="">Select relationship...</option>
              {relationshipList.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Follow-up Interval</label>
            <select className="input" value={form.interval} onChange={set('interval')}>
              <option value="">Select interval...</option>
              {INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Mobile Phone</label>
            <input className="input" value={form.mobilePhone} onChange={set('mobilePhone')} />
          </div>
          <div>
            <label className="label">Office Phone</label>
            <input className="input" value={form.officePhone} onChange={set('officePhone')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Location</label>
            <input className="input" value={form.location} onChange={set('location')} placeholder="City, State" />
          </div>
          <div>
            <label className="label">Next Follow Up</label>
            <input className="input" type="date" value={form.nextFollowUp} onChange={set('nextFollowUp')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Birthday</label>
            <input className="input" type="date" value={form.birthdate} onChange={set('birthdate')} />
          </div>
          <div>
            <label className="label">University</label>
            <input className="input" value={form.university} onChange={set('university')} />
          </div>
        </div>

        <div>
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={set('address')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">LinkedIn</label>
            <input className="input" value={form.linkedin} onChange={set('linkedin')} />
          </div>
          <div>
            <label className="label">Website</label>
            <input className="input" value={form.website} onChange={set('website')} />
          </div>
        </div>

        <div>
          <label className="label">Client Notes</label>
          <textarea
            className="input min-h-[80px] resize-y"
            value={form.clientNotes}
            onChange={set('clientNotes')}
          />
        </div>

        {saveError && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{saveError}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : contact ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
