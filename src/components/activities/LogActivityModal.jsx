import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Phone, Mail, Users, FileText, MessageSquare, AlertCircle } from 'lucide-react'

const TYPES = [
  { value: 'call',    label: 'Call',    Icon: Phone },
  { value: 'email',   label: 'Email',   Icon: Mail },
  { value: 'meeting', label: 'Meeting', Icon: Users },
  { value: 'note',    label: 'Note',    Icon: FileText },
  { value: 'sms',     label: 'SMS',     Icon: MessageSquare },
]

const todayISO = () => new Date().toISOString().slice(0, 16) // "YYYY-MM-DDTHH:MM"

export default function LogActivityModal({ onClose, onSave }) {
  const [type, setType] = useState('call')
  const [notes, setNotes] = useState('')
  const [occurredAt, setOccurredAt] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({
        type,
        notes: notes.trim(),
        occurredAt: new Date(occurredAt).toISOString(),
      })
      onClose()
    } catch (err) {
      setError(err?.message ?? 'Failed to save activity.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Log Activity" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type selector */}
        <div>
          <label className="label">Type</label>
          <div className="flex gap-2 flex-wrap">
            {TYPES.map(({ value, label, Icon }) => (
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
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[90px] resize-y"
            placeholder="What happened? Any key details..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Date/time */}
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

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

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
