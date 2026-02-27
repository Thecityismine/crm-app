import { useState, useMemo, useRef, useEffect } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useContactStore } from '@/store/contactStore'
import { logActivity } from '@/lib/firebase/activities'
import { updateContact as apiUpdateContact, createContact } from '@/lib/firebase/contacts'
import { createDeal } from '@/lib/firebase/deals'
import { createTask } from '@/lib/firebase/tasks'
import Modal from '@/components/ui/Modal'
import { Phone, Mail, Users, FileText, MessageSquare, AlertCircle, Search } from 'lucide-react'

const ACTIVITY_TYPES = [
  { value: 'call',    label: 'Call',    Icon: Phone },
  { value: 'email',   label: 'Email',   Icon: Mail },
  { value: 'meeting', label: 'Meeting', Icon: Users },
  { value: 'note',    label: 'Note',    Icon: FileText },
  { value: 'sms',     label: 'SMS',     Icon: MessageSquare },
]

const COMMUNICATION_TYPES = new Set(['call', 'email', 'meeting', 'sms'])
const todayISO = () => new Date().toISOString().slice(0, 16)

// ── Shared contact combobox ───────────────────────────────────────────────────
function ContactPicker({ contacts, value, onChange, placeholder = 'Search contacts...' }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef()

  // Sync display text when value changes externally
  useEffect(() => {
    if (!value) { setSearch(''); return }
    const c = contacts.find((c) => c.id === value)
    if (c) setSearch(`${c.firstName} ${c.lastName}`)
  }, [value])

  const results = useMemo(() => {
    const q = search.toLowerCase()
    return contacts
      .filter((c) =>
        !q ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q)
      )
      .slice(0, 7)
  }, [contacts, search])

  const select = (c) => {
    onChange(c.id)
    setSearch(`${c.firstName} ${c.lastName}`)
    setOpen(false)
  }

  const handleChange = (e) => {
    setSearch(e.target.value)
    setOpen(true)
    if (!e.target.value) onChange('')
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          className="input pl-8"
          placeholder={placeholder}
          value={search}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-h-44 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={() => select(c)}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-gray-800 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-white font-semibold leading-none">
                  {(c.firstName?.[0] || '').toUpperCase()}{(c.lastName?.[0] || '').toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-200 truncate">{c.firstName} {c.lastName}</p>
                {c.company && <p className="text-xs text-gray-500 truncate">{c.company}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
      <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-red-400">{message}</p>
    </div>
  )
}

// ── 1. Log Activity (global — with contact picker) ────────────────────────────
function GlobalActivityModal({ onClose }) {
  const { contacts, updateContact: storeUpdate } = useContactStore()
  const [contactId,  setContactId]  = useState('')
  const [type,       setType]       = useState('call')
  const [notes,      setNotes]      = useState('')
  const [occurredAt, setOccurredAt] = useState(todayISO())
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!contactId) { setError('Please select a contact.'); return }
    setSaving(true)
    setError('')
    try {
      const data = {
        type,
        notes:      notes.trim(),
        occurredAt: new Date(occurredAt).toISOString(),
      }
      await logActivity(contactId, data)
      if (COMMUNICATION_TYPES.has(type)) {
        const dateOnly = new Date(occurredAt).toISOString().slice(0, 10)
        await apiUpdateContact(contactId, { lastCommunication: dateOnly })
        storeUpdate(contactId, { lastCommunication: dateOnly })
      }
      onClose()
    } catch (err) {
      setError(err?.message ?? 'Failed to log activity.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Log Activity" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Contact</label>
          <ContactPicker contacts={contacts} value={contactId} onChange={setContactId} />
        </div>

        <div>
          <label className="label">Type</label>
          <div className="flex gap-2 flex-wrap">
            {ACTIVITY_TYPES.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  type === value
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[80px] resize-y"
            placeholder="What happened? Any key details..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Date & Time</label>
          <input
            className="input"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            required
          />
        </div>

        <ErrorBanner message={error} />

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Log Activity'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── 2. New Contact ────────────────────────────────────────────────────────────
function QuickAddContactModal({ onClose }) {
  const { addContact } = useContactStore()
  const [form,   setForm]   = useState({ firstName: '', lastName: '', company: '', email: '', mobilePhone: '' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const f = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.firstName.trim() && !form.lastName.trim()) {
      setError('First name or last name is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const data = {
        firstName:   form.firstName.trim(),
        lastName:    form.lastName.trim(),
        company:     form.company.trim()     || null,
        email:       form.email.trim()       || null,
        mobilePhone: form.mobilePhone.trim() || null,
        source:      'quick_add',
      }
      const { id } = await createContact(data)
      addContact({ id, ...data })
      onClose()
    } catch (err) {
      setError(err?.message ?? 'Failed to create contact.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="New Contact" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First Name</label>
            <input autoFocus className="input" value={form.firstName} onChange={f('firstName')} placeholder="Jane" />
          </div>
          <div>
            <label className="label">Last Name</label>
            <input className="input" value={form.lastName} onChange={f('lastName')} placeholder="Smith" />
          </div>
        </div>
        <div>
          <label className="label">Company</label>
          <input className="input" value={form.company} onChange={f('company')} placeholder="Acme Capital" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={f('email')} placeholder="jane@example.com" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" type="tel" value={form.mobilePhone} onChange={f('mobilePhone')} placeholder="+1 (555) 000-0000" />
          </div>
        </div>

        <ErrorBanner message={error} />

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create Contact'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── 3. New Deal ───────────────────────────────────────────────────────────────
function QuickAddDealModal({ onClose }) {
  const { contacts } = useContactStore()
  const [title,     setTitle]     = useState('')
  const [contactId, setContactId] = useState('')
  const [value,     setValue]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) { setError('Deal title is required.'); return }
    setSaving(true)
    setError('')
    try {
      const contact = contacts.find((c) => c.id === contactId)
      await createDeal({
        title:       title.trim(),
        stage:       'Lead',
        value:       value ? Number(value) : null,
        contactId:   contactId || null,
        contactName: contact ? `${contact.firstName} ${contact.lastName}` : null,
      })
      onClose()
    } catch (err) {
      setError(err?.message ?? 'Failed to create deal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="New Deal" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label">Deal Title *</label>
          <input
            autoFocus
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 123 Main St Acquisition"
            required
          />
        </div>
        <div>
          <label className="label">Contact</label>
          <ContactPicker contacts={contacts} value={contactId} onChange={setContactId} />
        </div>
        <div>
          <label className="label">Deal Value ($)</label>
          <input
            className="input"
            type="number"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
          />
        </div>

        <ErrorBanner message={error} />

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create Deal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── 4. New Task ───────────────────────────────────────────────────────────────
function QuickAddTaskModal({ onClose }) {
  const { contacts } = useContactStore()
  const [title,     setTitle]     = useState('')
  const [dueDate,   setDueDate]   = useState('')
  const [priority,  setPriority]  = useState('medium')
  const [contactId, setContactId] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) { setError('Task title is required.'); return }
    setSaving(true)
    setError('')
    try {
      const contact = contacts.find((c) => c.id === contactId)
      await createTask({
        title:       title.trim(),
        status:      'open',
        priority,
        dueDate:     dueDate || null,
        contactId:   contactId || null,
        contactName: contact ? `${contact.firstName} ${contact.lastName}` : null,
      })
      onClose()
    } catch (err) {
      setError(err?.message ?? 'Failed to create task.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="New Task" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label">Task Title *</label>
          <input
            autoFocus
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Follow up with client"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Priority</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="label">Due Date</label>
            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Contact</label>
          <ContactPicker contacts={contacts} value={contactId} onChange={setContactId} />
        </div>

        <ErrorBanner message={error} />

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Dispatcher — renders whichever modal quickAction demands ──────────────────
export default function GlobalModals() {
  const { quickAction, closeQuickAction } = useUIStore()
  if (!quickAction) return null

  switch (quickAction) {
    case 'log-activity': return <GlobalActivityModal    onClose={closeQuickAction} />
    case 'new-contact':  return <QuickAddContactModal   onClose={closeQuickAction} />
    case 'new-deal':     return <QuickAddDealModal      onClose={closeQuickAction} />
    case 'new-task':     return <QuickAddTaskModal      onClose={closeQuickAction} />
    default:             return null
  }
}
