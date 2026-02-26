import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Briefcase, ArrowUpDown, ArrowUp, ArrowDown, Kanban } from 'lucide-react'
import { getDeals, createDeal, updateDeal, deleteDeal } from '@/lib/firebase/deals'
import { useContactStore } from '@/store/contactStore'
import Modal from '@/components/ui/Modal'
import { Trash2 } from 'lucide-react'

const STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']

const STAGE_STYLES = {
  Lead:        'bg-gray-700 text-gray-300',
  Qualified:   'bg-blue-500/20 text-blue-300',
  Proposal:    'bg-yellow-500/20 text-yellow-300',
  Negotiation: 'bg-orange-500/20 text-orange-300',
  Won:         'bg-emerald-500/20 text-emerald-300',
  Lost:        'bg-red-500/15 text-red-400',
}

const fmt = (n) =>
  n > 0
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
    : '—'

const fmtDate = (d) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

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
    setForm((f) => ({ ...f, contactId: id, contactName: c ? `${c.firstName} ${c.lastName}` : '' }))
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
          <input className="input" placeholder="e.g. 123 Main St Lease" value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Value ($)</label>
            <input className="input" type="number" min="0" placeholder="0" value={form.value}
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
          <textarea className="input resize-none" rows={3} placeholder="Deal notes..."
            value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex items-center gap-3 pt-1">
          {deal && onDelete && (
            <button type="button" onClick={handleDelete} disabled={saving}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors ${
                confirming ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-500/40'
              }`}>
              <Trash2 size={13} />{confirming ? 'Confirm delete' : 'Delete'}
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

function SortButton({ field, current, dir, onSort }) {
  const active = current === field
  return (
    <button onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-gray-200 transition-colors">
      {active ? (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />}
    </button>
  )
}

const FILTER_TABS = [
  { key: 'all',    label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'won',    label: 'Won' },
  { key: 'lost',   label: 'Lost' },
]

export default function Deals() {
  const navigate = useNavigate()
  const { contacts } = useContactStore()
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const [modal, setModal] = useState(null)

  useEffect(() => {
    getDeals().then(setDeals).catch(console.warn).finally(() => setLoading(false))
  }, [])

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let list = deals

    // Stage filter
    if (filter === 'active') list = list.filter((d) => !['Won', 'Lost'].includes(d.stage))
    else if (filter === 'won') list = list.filter((d) => d.stage === 'Won')
    else if (filter === 'lost') list = list.filter((d) => d.stage === 'Lost')

    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((d) =>
        d.title?.toLowerCase().includes(q) ||
        d.contactName?.toLowerCase().includes(q) ||
        d.stage?.toLowerCase().includes(q)
      )
    }

    // Sort
    return [...list].sort((a, b) => {
      let av, bv
      if (sortField === 'value') { av = Number(a.value) || 0; bv = Number(b.value) || 0 }
      else if (sortField === 'closingDate') { av = a.closingDate || ''; bv = b.closingDate || '' }
      else if (sortField === 'stage') { av = STAGES.indexOf(a.stage); bv = STAGES.indexOf(b.stage) }
      else if (sortField === 'title') { av = a.title?.toLowerCase() || ''; bv = b.title?.toLowerCase() || '' }
      else { av = a.createdAt || ''; bv = b.createdAt || '' }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [deals, filter, search, sortField, sortDir])

  const counts = useMemo(() => ({
    all:    deals.length,
    active: deals.filter((d) => !['Won', 'Lost'].includes(d.stage)).length,
    won:    deals.filter((d) => d.stage === 'Won').length,
    lost:   deals.filter((d) => d.stage === 'Lost').length,
  }), [deals])

  const totalValue = useMemo(
    () => filtered.reduce((s, d) => s + (Number(d.value) || 0), 0),
    [filtered]
  )

  const handleSave = async (data) => {
    if (modal.mode === 'add') {
      const { id } = await createDeal(data)
      setDeals((prev) => [{ id, ...data }, ...prev])
    } else {
      await updateDeal(modal.deal.id, data)
      setDeals((prev) => prev.map((d) => d.id === modal.deal.id ? { ...d, ...data } : d))
    }
    setModal(null)
  }

  const handleDelete = async () => {
    await deleteDeal(modal.deal.id)
    setDeals((prev) => prev.filter((d) => d.id !== modal.deal.id))
    setModal(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Deals</h1>
          <p className="text-gray-500 text-sm mt-0.5">{counts.all} deals · {totalValue > 0 ? fmt(totalValue) : 'no value set'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/pipeline')} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Kanban size={14} /> Pipeline view
          </button>
          <button onClick={() => setModal({ mode: 'add' })} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Add Deal
          </button>
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1 border-b border-gray-800 flex-1">
          {FILTER_TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                filter === key ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              {label}
              <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
                filter === key ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-600'
              }`}>{counts[key]}</span>
            </button>
          ))}
        </div>
        <input
          className="input text-sm w-52 flex-shrink-0"
          placeholder="Search deals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-600 text-sm">Loading deals...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Briefcase size={32} className="text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">{search ? 'No deals match your search' : 'No deals yet'}</p>
          {!search && (
            <button onClick={() => setModal({ mode: 'add' })} className="mt-3 text-xs text-blue-400 hover:text-blue-300">
              Add your first deal
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    Deal <SortButton field="title" current={sortField} dir={sortDir} onSort={handleSort} />
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium hidden md:table-cell">
                  Contact
                </th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    Stage <SortButton field="stage" current={sortField} dir={sortDir} onSort={handleSort} />
                  </div>
                </th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">
                  <div className="flex items-center gap-1.5 justify-end">
                    Value <SortButton field="value" current={sortField} dir={sortDir} onSort={handleSort} />
                  </div>
                </th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium hidden lg:table-cell">
                  <div className="flex items-center gap-1.5 justify-end">
                    Close Date <SortButton field="closingDate" current={sortField} dir={sortDir} onSort={handleSort} />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((deal) => {
                const isPastClose = deal.closingDate && new Date(deal.closingDate + 'T12:00:00') < new Date() && deal.stage !== 'Won' && deal.stage !== 'Lost'
                return (
                  <tr
                    key={deal.id}
                    className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/40 cursor-pointer transition-colors group"
                    onClick={() => navigate(`/deals/${deal.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-200 font-medium truncate max-w-[200px]">{deal.title}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {deal.contactName ? (
                        <p className="text-sm text-gray-400 truncate max-w-[160px]">{deal.contactName}</p>
                      ) : (
                        <span className="text-gray-700 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STAGE_STYLES[deal.stage] || 'bg-gray-700 text-gray-300'}`}>
                        {deal.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${deal.value > 0 ? 'text-emerald-400' : 'text-gray-600'}`}>
                        {fmt(deal.value)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <span className={`text-sm ${isPastClose ? 'text-red-400' : 'text-gray-500'}`}>
                        {fmtDate(deal.closingDate)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {/* Footer total */}
          {filter !== 'all' && totalValue > 0 && (
            <div className="flex items-center justify-end px-4 py-2 border-t border-gray-800 bg-gray-900/50">
              <span className="text-xs text-gray-500 mr-2">Total:</span>
              <span className="text-sm font-semibold text-emerald-400">{fmt(totalValue)}</span>
            </div>
          )}
        </div>
      )}

      {modal && (
        <DealModal
          deal={modal.mode === 'edit' ? modal.deal : null}
          initialStage={modal.mode === 'add' ? 'Lead' : undefined}
          contacts={contacts}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
