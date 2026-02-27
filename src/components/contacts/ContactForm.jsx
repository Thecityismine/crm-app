import { useState, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import { useSettingsStore } from '@/store/settingsStore'
import { ensureCompany } from '@/lib/firebase/companies'
import { storage } from '@/config/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { AlertCircle, Camera, Loader2, Plus, X } from 'lucide-react'

const INTERVALS = ['30 Days', '60 Days', '90 Days', '6 Months', '1 Year']

const emptyForm = {
  firstName: '', lastName: '', company: '', title: '', relationship: '',
  emails: [''], mobilePhone: '', officePhone: '',
  location: '', address: '', linkedin: '', website: '', interval: '',
  nextFollowUp: '', birthdate: '', clientNotes: '', university: '', photoUrl: '',
}

function initEmails(contact) {
  if (!contact) return ['']
  if (Array.isArray(contact.emails) && contact.emails.length) return contact.emails.map((e) => e || '')
  return [contact.email || '']
}

export default function ContactForm({ contact, onClose, onSave }) {
  const relationshipOptions = useSettingsStore((s) => s.relationshipOptions)
  const fileInputRef = useRef(null)

  const [form, setForm] = useState(contact ? {
    firstName:    contact.firstName    || '',
    lastName:     contact.lastName     || '',
    company:      contact.company      || '',
    title:        contact.title        || '',
    relationship: contact.relationship || '',
    emails:       initEmails(contact),
    mobilePhone:  contact.mobilePhone  || '',
    officePhone:  contact.officePhone  || '',
    location:     contact.location     || '',
    address:      contact.address      || '',
    linkedin:     contact.linkedin     || '',
    website:      contact.website      || '',
    interval:     contact.interval     || '',
    nextFollowUp: contact.nextFollowUp ? contact.nextFollowUp.slice(0, 10) : '',
    birthdate:    contact.birthdate    ? contact.birthdate.slice(0, 10)    : '',
    clientNotes:  contact.clientNotes  || '',
    university:   contact.university   || '',
    photoUrl:     contact.photoUrl     || '',
  } : emptyForm)

  const [saving,      setSaving]      = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [saveError,   setSaveError]   = useState('')
  const [uploadError, setUploadError] = useState('')

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  // ── Email list helpers ───────────────────────────────────────────────────
  const setEmail = (i, val) =>
    setForm((f) => { const e = [...f.emails]; e[i] = val; return { ...f, emails: e } })
  const addEmail = () =>
    setForm((f) => ({ ...f, emails: [...f.emails, ''] }))
  const removeEmail = (i) =>
    setForm((f) => ({ ...f, emails: f.emails.filter((_, idx) => idx !== i) }))

  // ── Photo upload ─────────────────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const storageRef = ref(storage, `contact-photos/${Date.now()}_${file.name}`)
      const uploadTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Upload timed out. Check your connection or paste a photo URL instead.')), 20000)
      )
      await Promise.race([uploadBytes(storageRef, file), uploadTimeout])
      const url = await getDownloadURL(storageRef)
      setForm((f) => ({ ...f, photoUrl: url }))
    } catch (err) {
      setUploadError(err?.message ?? 'Photo upload failed. You can still save the contact.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const cleanEmails = form.emails.map((e) => e.trim()).filter(Boolean)
      const data = {
        ...form,
        email:         cleanEmails[0] || '',   // keep primary email field for backward compat
        emails:        cleanEmails,
        nextFollowUp:  form.nextFollowUp ? new Date(form.nextFollowUp).toISOString() : null,
      }
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Save timed out — check your connection and try again.')), 15000)
      )
      await Promise.race([onSave(data), timeout])
      if (data.company?.trim()) ensureCompany(data.company)
      onClose()
    } catch (err) {
      console.error('ContactForm save error:', err)
      setSaveError(err?.message ?? 'Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const relationshipList = (contact?.relationship && !relationshipOptions.includes(contact.relationship))
    ? [...relationshipOptions, contact.relationship]
    : relationshipOptions

  return (
    <Modal title={contact ? 'Edit Contact' : 'New Contact'} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <Avatar firstName={form.firstName} lastName={form.lastName} size="lg" src={form.photoUrl} linkedin={form.linkedin} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload photo"
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {uploading
                ? <Loader2 size={11} className="text-white animate-spin" />
                : <Camera size={11} className="text-white" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="label">Photo URL <span className="text-gray-600 font-normal">(or upload above)</span></label>
            <input
              className="input text-xs"
              placeholder="Paste URL to override"
              value={form.photoUrl}
              onChange={set('photoUrl')}
            />
          </div>
        </div>

        {uploadError && (
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <AlertCircle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-400">{uploadError}</p>
          </div>
        )}

        {/* Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">First Name *</label>
            <input className="input" value={form.firstName} onChange={set('firstName')} required />
          </div>
          <div>
            <label className="label">Last Name</label>
            <input className="input" value={form.lastName} onChange={set('lastName')} />
          </div>
        </div>

        {/* Company / Title */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Company</label>
            <input className="input" value={form.company} onChange={set('company')} />
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={set('title')} />
          </div>
        </div>

        {/* Relationship / Interval */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {/* Emails — dynamic list */}
        <div>
          <label className="label">Email(s)</label>
          <div className="space-y-2">
            {form.emails.map((email, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(i, e.target.value)}
                  placeholder={i === 0 ? 'Primary email' : 'Additional email'}
                />
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => removeEmail(i)}
                    className="flex-shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addEmail}
            className="mt-2 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus size={12} /> Add another email
          </button>
        </div>

        {/* Phones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Mobile Phone</label>
            <input className="input" value={form.mobilePhone} onChange={set('mobilePhone')} />
          </div>
          <div>
            <label className="label">Office Phone</label>
            <input className="input" value={form.officePhone} onChange={set('officePhone')} />
          </div>
        </div>

        {/* Location / Next Follow Up */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Location</label>
            <input className="input" value={form.location} onChange={set('location')} placeholder="City, State" />
          </div>
          <div>
            <label className="label">Next Follow Up</label>
            <input className="input" type="date" value={form.nextFollowUp} onChange={set('nextFollowUp')} />
          </div>
        </div>

        {/* Birthday / University */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Birthday</label>
            <input className="input" type="date" value={form.birthdate} onChange={set('birthdate')} />
          </div>
          <div>
            <label className="label">University</label>
            <input className="input" value={form.university} onChange={set('university')} />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={set('address')} />
        </div>

        {/* LinkedIn / Website */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">LinkedIn</label>
            <input className="input" value={form.linkedin} onChange={set('linkedin')} />
          </div>
          <div>
            <label className="label">Website</label>
            <input className="input" value={form.website} onChange={set('website')} />
          </div>
        </div>

        {/* Notes */}
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
          <button type="submit" className="btn-primary" disabled={saving || uploading}>
            {saving ? 'Saving...' : contact ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
