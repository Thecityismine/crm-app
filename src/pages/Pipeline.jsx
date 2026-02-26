import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import KanbanBoard, { PIPELINE_STAGES } from '@/components/pipeline/KanbanBoard'
import Modal from '@/components/ui/Modal'
import { createDeal, updateDeal, deleteDeal } from '@/lib/firebase/deals'
import { useContactStore } from '@/store/contactStore'

function DealModal({ deal, initialStage, contacts, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    title:       deal?.title       || '',
    value:       deal?.value       || '',
    stage:       deal?.stage       || initialStage || 'Lead',
    contactId:   deal?.contactId   || '',
    contactName: deal?.contactName || '',
    closingDate: deal?.closingDate || '',
    notes:       deal?.notes       || '',
  })
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const handleContactChange = (id) => {
    const c = contacts.find((x) => x.id === id)
    setForm((f) => ({
      ...f,
      contactId:   id,
      contactName: c ? `${c.firstName} ${c.lastName}` : '',
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onSave({
        title:       form.title.trim(),
        value:       form.value !== '' ? Number(form.value) : null,
        stage:       form.stage,
        contactId:   form.contactId || null,
        contactName: form.contactName || null,
        closingDate: form.closingDate || null,
        notes:       form.notes.trim() || null,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirming) { setConfirming(true); return }
    setSaving(true)
    try { await onDelete() } finally { setSaving(false) }
  }

  return (
    <Modal title={deal ? 'Edit Deal' : 'Add Deal'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="label">Deal Title *</label>
          <input
            className="input"
            placeholder="e.g. 123 Main St Lease"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Value ($)</label>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="0"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Stage</label>
            <select
              className="input"
              value={form.stage}
              onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Contact</label>
          <select
            className="input"
            value={form.contactId}
            onChange={(e) => handleContactChange(e.target.value)}
          >
            <option value="">— None —</option>
            {contacts
              .slice()
              .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                  {c.company ? ` — ${c.company}` : ''}
                </option>
              ))
            }
          </select>
        </div>

        <div>
          <label className="label">Expected Close Date</label>
          <input
            className="input"
            type="date"
            value={form.closingDate}
            onChange={(e) => setForm((f) => ({ ...f, closingDate: e.target.value }))}
          />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Deal notes, key details..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          {deal && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors ${
                confirming
                  ? 'bg-red-500/20 border-red-500/50 text-red-400'
                  : 'border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-500/40'
              }`}
            >
              <Trash2 size={13} />
              {confirming ? 'Confirm delete' : 'Delete'}
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : (deal ? 'Save Changes' : 'Add Deal')}
            </button>
          </div>
        </div>

      </form>
    </Modal>
  )
}

export default function Pipeline() {
  const { contacts } = useContactStore()
  const [refreshKey, setRefreshKey] = useState(0)
  const [modal, setModal] = useState(null) // null | { mode: 'add', stage } | { mode: 'edit', deal }

  const refresh = () => setRefreshKey((k) => k + 1)

  const handleAddDeal = (stage = 'Lead') => setModal({ mode: 'add', stage })
  const handleDealClick = (deal) => setModal({ mode: 'edit', deal })

  const handleSave = async (data) => {
    if (modal.mode === 'add') {
      await createDeal(data)
    } else {
      await updateDeal(modal.deal.id, data)
    }
    setModal(null)
    refresh()
  }

  const handleDelete = async () => {
    await deleteDeal(modal.deal.id)
    setModal(null)
    refresh()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Pipeline</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track your deals and opportunities</p>
        </div>
        <button onClick={() => handleAddDeal()} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Add Deal
        </button>
      </div>

      <KanbanBoard
        onAddDeal={handleAddDeal}
        onDealClick={handleDealClick}
        refreshKey={refreshKey}
      />

      {modal && (
        <DealModal
          deal={modal.mode === 'edit' ? modal.deal : null}
          initialStage={modal.mode === 'add' ? modal.stage : undefined}
          contacts={contacts}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
