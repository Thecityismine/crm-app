import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDeal, updateDeal, deleteDeal } from '@/lib/firebase/deals'
import { useContactStore } from '@/store/contactStore'
import {
  ArrowLeft, Edit2, Trash2, DollarSign, Calendar, User,
  ChevronRight, Kanban
} from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import HealthScoreBadge from '@/components/ui/HealthScoreBadge'
import Modal from '@/components/ui/Modal'

const STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']

const STAGE_STYLES = {
  Lead:        'bg-gray-700 text-gray-300 border-gray-600',
  Qualified:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Proposal:    'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Negotiation: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Won:         'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Lost:        'bg-red-500/15 text-red-400 border-red-500/20',
}

const fmt = (n) =>
  n > 0
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
    : null

const fmtDate = (d) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null

function EditModal({ deal, contacts, onClose, onSave }) {
  const [form, setForm] = useState({
    title:       deal.title       || '',
    value:       deal.value       || '',
    stage:       deal.stage       || 'Lead',
    contactId:   deal.contactId   || '',
    contactName: deal.contactName || '',
    closingDate: deal.closingDate || '',
    notes:       deal.notes       || '',
  })
  const [saving, setSaving] = useState(false)

  const handleContactChange = (id) => {
    const c = contacts.find((x) => x.id === id)
    setForm((f) => ({ ...f, contactId: id, contactName: c ? `${c.firstName} ${c.lastName}` : '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
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

  return (
    <Modal title="Edit Deal" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Deal Title *</label>
          <input className="input" value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Value ($)</label>
            <input className="input" type="number" min="0" value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
          </div>
          <div>
            <label className="label">Stage</label>
            <select className="input" value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Contact</label>
          <select className="input" value={form.contactId} onChange={(e) => handleContactChange(e.target.value)}>
            <option value="">— None —</option>
            {contacts.slice().sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
              .map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.company ? ` — ${c.company}` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Expected Close Date</label>
          <input className="input" type="date" value={form.closingDate}
            onChange={(e) => setForm((f) => ({ ...f, closingDate: e.target.value }))} />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={3} value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function DealDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { contacts } = useContactStore()

  const [deal, setDeal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [movingTo, setMovingTo] = useState(null)

  useEffect(() => {
    getDeal(id).then(setDeal).catch(console.warn).finally(() => setLoading(false))
  }, [id])

  const linkedContact = useMemo(() => {
    if (!deal?.contactId) return null
    return contacts.find((c) => c.id === deal.contactId) || null
  }, [contacts, deal])

  const handleSave = async (data) => {
    await updateDeal(id, data)
    setDeal((d) => ({ ...d, ...data }))
    setShowEdit(false)
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${deal.title}"? This cannot be undone.`)) return
    await deleteDeal(id)
    navigate('/deals')
  }

  const handleMoveStage = async (stage) => {
    if (stage === deal.stage) return
    setMovingTo(stage)
    try {
      await updateDeal(id, { stage })
      setDeal((d) => ({ ...d, stage }))
    } catch (err) {
      console.warn('Stage move failed:', err)
    } finally {
      setMovingTo(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-600 text-sm">Loading...</div>
  }

  if (!deal) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <p className="text-gray-500 text-sm">Deal not found.</p>
        <button onClick={() => navigate('/deals')} className="mt-3 text-xs text-blue-400 hover:text-blue-300">
          Back to Deals
        </button>
      </div>
    )
  }

  const isPastClose = deal.closingDate
    && new Date(deal.closingDate + 'T12:00:00') < new Date()
    && deal.stage !== 'Won' && deal.stage !== 'Lost'

  return (
    <div className="max-w-3xl">
      {/* Back */}
      <button onClick={() => navigate('/deals')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-5 transition-colors">
        <ArrowLeft size={15} /> Deals
      </button>

      {/* Header */}
      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${STAGE_STYLES[deal.stage] || STAGE_STYLES.Lead}`}>
                {deal.stage}
              </span>
              {deal.value > 0 && (
                <span className="text-xl font-bold text-emerald-400">{fmt(deal.value)}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-100">{deal.title}</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 btn-secondary text-xs px-3 py-1.5">
              <Edit2 size={13} /> Edit
            </button>
            <button onClick={handleDelete}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Info row */}
        <div className="flex flex-wrap gap-6 pt-4 border-t border-gray-800">
          {deal.closingDate && (
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Close Date</p>
                <p className={`text-sm ${isPastClose ? 'text-red-400' : 'text-gray-300'}`}>
                  {fmtDate(deal.closingDate)}
                  {isPastClose && <span className="text-xs text-red-500 ml-1">(overdue)</span>}
                </p>
              </div>
            </div>
          )}
          {deal.contactName && (
            <div className="flex items-center gap-2">
              <User size={14} className="text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Contact</p>
                <p className="text-sm text-gray-300">{deal.contactName}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Stage pipeline */}
        <div className="lg:col-span-3 card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Kanban size={14} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-300">Pipeline Stage</h2>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {STAGES.map((stage, i) => {
              const isCurrent = deal.stage === stage
              const isMoving = movingTo === stage
              return (
                <div key={stage} className="flex items-center">
                  <button
                    onClick={() => handleMoveStage(stage)}
                    disabled={!!movingTo}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      isCurrent
                        ? `${STAGE_STYLES[stage]} font-semibold`
                        : 'border-gray-700 text-gray-600 hover:text-gray-400 hover:border-gray-500'
                    } ${isMoving ? 'opacity-60' : ''}`}
                  >
                    {stage}
                  </button>
                  {i < STAGES.length - 1 && (
                    <ChevronRight size={12} className="text-gray-700 mx-0.5 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-700 mt-3">Click a stage to move this deal</p>
        </div>

        {/* Linked contact */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={14} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-300">Contact</h2>
          </div>
          {linkedContact ? (
            <div
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/contacts/${linkedContact.id}`)}
            >
              <Avatar firstName={linkedContact.firstName} lastName={linkedContact.lastName}
                src={linkedContact.photoUrl} linkedin={linkedContact.linkedin} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 truncate">{linkedContact.firstName} {linkedContact.lastName}</p>
                {linkedContact.title && <p className="text-xs text-gray-500 truncate">{linkedContact.title}</p>}
                {linkedContact.company && <p className="text-xs text-gray-600 truncate">{linkedContact.company}</p>}
              </div>
              <HealthScoreBadge contact={linkedContact} />
            </div>
          ) : deal.contactName ? (
            <p className="text-sm text-gray-500">{deal.contactName}</p>
          ) : (
            <p className="text-sm text-gray-700">No contact linked</p>
          )}
        </div>
      </div>

      {/* Notes */}
      {deal.notes && (
        <div className="card p-5 mt-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Notes</h2>
          <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">{deal.notes}</p>
        </div>
      )}

      {showEdit && (
        <EditModal deal={deal} contacts={contacts} onClose={() => setShowEdit(false)} onSave={handleSave} />
      )}
    </div>
  )
}
