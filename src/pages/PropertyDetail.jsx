import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getProperty, updateProperty, deleteProperty,
  getLeases, createLease, updateLease, deleteLease,
} from '@/lib/firebase/properties'
import { getDeals } from '@/lib/firebase/deals'
import { useContactStore } from '@/store/contactStore'
import { PROPERTY_TYPES, LEASE_TYPES } from '@/config/constants'
import {
  ArrowLeft, Edit2, Trash2, MapPin, Building2, DollarSign,
  Layers, Plus, Users, Briefcase, AlertCircle, ChevronRight,
} from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import Modal from '@/components/ui/Modal'

const TYPE_LABELS = {
  office: 'Office', retail: 'Retail', industrial: 'Industrial',
  multifamily: 'Multifamily', land: 'Land', mixed_use: 'Mixed Use', other: 'Other',
}
const TYPE_STYLES = {
  office:      { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20' },
  retail:      { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20' },
  industrial:  { bg: 'bg-orange-500/10',  text: 'text-orange-400',  border: 'border-orange-500/20' },
  multifamily: { bg: 'bg-violet-500/10',  text: 'text-violet-400',  border: 'border-violet-500/20' },
  land:        { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  mixed_use:   { bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    border: 'border-cyan-500/20' },
  other:       { bg: 'bg-gray-500/10',    text: 'text-gray-400',    border: 'border-gray-500/20' },
}
const LEASE_TYPE_LABELS = { NNN: 'NNN', gross: 'Gross', modified_gross: 'Modified Gross', other: 'Other' }

const fmt = (n) =>
  n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n) : null

const fmtDate = (s) => {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const isExpired = (leaseEnd) => {
  if (!leaseEnd) return false
  return new Date(leaseEnd) < new Date()
}

const isSoonExpiring = (leaseEnd) => {
  if (!leaseEnd) return false
  const d = new Date(leaseEnd)
  const now = new Date()
  const diff = (d - now) / (1000 * 60 * 60 * 24)
  return diff > 0 && diff <= 90
}

// ── Edit Property Modal ──────────────────────────────────────────────────────
function EditPropertyModal({ property, onClose, onSave }) {
  const [form, setForm] = useState({
    name:     property.name     || '',
    address:  property.address  || '',
    type:     property.type     || '',
    size:     property.size     || '',
    value:    property.value    || '',
    location: property.location || '',
    notes:    property.notes    || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({
        name:     form.name.trim() || null,
        address:  form.address.trim() || null,
        type:     form.type || null,
        size:     form.size ? Number(form.size) : null,
        value:    form.value ? Number(form.value) : null,
        location: form.location.trim() || null,
        notes:    form.notes.trim() || null,
      })
    } catch (err) {
      setError(err?.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit Property" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Property Name</label>
          <input className="input" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label">Address *</label>
          <input className="input" value={form.address} onChange={set('address')} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={set('type')}>
              <option value="">— Select —</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Size (SF)</label>
            <input className="input" type="number" value={form.size} onChange={set('size')} min="0" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Market Value ($)</label>
            <input className="input" type="number" value={form.value} onChange={set('value')} min="0" />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={form.location} onChange={set('location')} />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={3} value={form.notes} onChange={set('notes')} />
        </div>
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Lease Modal ──────────────────────────────────────────────────────────────
function LeaseModal({ lease, onClose, onSave, onDelete }) {
  const { contacts } = useContactStore()
  const [form, setForm] = useState({
    tenantName:  lease?.tenantName  || '',
    contactId:   lease?.contactId   || '',
    leaseType:   lease?.leaseType   || '',
    rentPsf:     lease?.rentPsf     || '',
    leasedSf:    lease?.leasedSf    || '',
    leaseStart:  lease?.leaseStart  ? lease.leaseStart.slice(0, 10) : '',
    leaseEnd:    lease?.leaseEnd    ? lease.leaseEnd.slice(0, 10) : '',
    notes:       lease?.notes       || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({
        tenantName: form.tenantName.trim() || null,
        contactId:  form.contactId || null,
        leaseType:  form.leaseType || null,
        rentPsf:    form.rentPsf ? Number(form.rentPsf) : null,
        leasedSf:   form.leasedSf ? Number(form.leasedSf) : null,
        leaseStart: form.leaseStart ? new Date(form.leaseStart).toISOString() : null,
        leaseEnd:   form.leaseEnd   ? new Date(form.leaseEnd).toISOString()   : null,
        notes:      form.notes.trim() || null,
      })
    } catch (err) {
      setError(err?.message ?? 'Save failed.')
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
    <Modal title={lease ? 'Edit Lease' : 'Add Lease'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tenant Name</label>
            <input className="input" placeholder="Acme Corp" value={form.tenantName} onChange={set('tenantName')} />
          </div>
          <div>
            <label className="label">Linked Contact</label>
            <select className="input" value={form.contactId} onChange={set('contactId')}>
              <option value="">— None —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Lease Type</label>
            <select className="input" value={form.leaseType} onChange={set('leaseType')}>
              <option value="">— Select —</option>
              {LEASE_TYPES.map((t) => (
                <option key={t} value={t}>{LEASE_TYPE_LABELS[t] || t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Leased SF</label>
            <input className="input" type="number" placeholder="5000" value={form.leasedSf} onChange={set('leasedSf')} min="0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Rent ($/SF/yr)</label>
            <input className="input" type="number" placeholder="36" value={form.rentPsf} onChange={set('rentPsf')} min="0" step="0.01" />
          </div>
          <div>
            <label className="label">Annual Rent</label>
            <div className="input bg-gray-800/50 text-gray-500 text-sm flex items-center">
              {form.rentPsf && form.leasedSf
                ? fmt(Number(form.rentPsf) * Number(form.leasedSf))
                : '—'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Lease Start</label>
            <input className="input" type="date" value={form.leaseStart} onChange={set('leaseStart')} />
          </div>
          <div>
            <label className="label">Lease End</label>
            <input className="input" type="date" value={form.leaseEnd} onChange={set('leaseEnd')} />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={2} value={form.notes} onChange={set('notes')} />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          {lease && onDelete && (
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
              {saving ? 'Saving...' : lease ? 'Save Changes' : 'Add Lease'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function PropertyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { contacts } = useContactStore()

  const [property, setProperty] = useState(null)
  const [leases, setLeases] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [leaseModal, setLeaseModal] = useState(null) // null | { mode: 'add' } | { mode: 'edit', lease }

  useEffect(() => {
    Promise.all([getProperty(id), getLeases(id), getDeals()])
      .then(([p, l, d]) => { setProperty(p); setLeases(l); setDeals(d) })
      .catch(console.warn)
      .finally(() => setLoading(false))
  }, [id])

  // Contacts that reference this property address or ID
  const linkedContacts = useMemo(() => {
    if (!property) return []
    const leaseContactIds = new Set(leases.map((l) => l.contactId).filter(Boolean))
    return contacts.filter((c) => leaseContactIds.has(c.id))
  }, [contacts, leases, property])

  // Deals linked via contacts in this property's leases
  const linkedDeals = useMemo(() => {
    if (!property) return []
    const contactIds = new Set(linkedContacts.map((c) => c.id))
    return deals.filter((d) => contactIds.has(d.contactId))
  }, [deals, linkedContacts])

  const handleSave = async (data) => {
    await updateProperty(id, data)
    setProperty((p) => ({ ...p, ...data }))
    setShowEdit(false)
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete this property? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteProperty(id)
      navigate('/properties')
    } finally {
      setDeleting(false)
    }
  }

  const handleLeaseSave = async (data) => {
    if (leaseModal.mode === 'add') {
      const { id: leaseId } = await createLease(id, data)
      setLeases((prev) => [...prev, { id: leaseId, ...data }])
    } else {
      await updateLease(id, leaseModal.lease.id, data)
      setLeases((prev) =>
        prev.map((l) => l.id === leaseModal.lease.id ? { ...l, ...data } : l)
      )
    }
    setLeaseModal(null)
  }

  const handleLeaseDelete = async () => {
    await deleteLease(id, leaseModal.lease.id)
    setLeases((prev) => prev.filter((l) => l.id !== leaseModal.lease.id))
    setLeaseModal(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-600 text-sm">Loading...</div>
  }

  if (!property) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <p className="text-gray-500 text-sm">Property not found.</p>
        <button onClick={() => navigate('/properties')} className="mt-3 text-xs text-blue-400 hover:text-blue-300">
          Back to Properties
        </button>
      </div>
    )
  }

  const style = TYPE_STYLES[property.type] || TYPE_STYLES.other
  const totalAnnualRent = leases.reduce((sum, l) => {
    if (l.rentPsf && l.leasedSf) return sum + Number(l.rentPsf) * Number(l.leasedSf)
    return sum
  }, 0)
  const occupiedSf = leases.reduce((sum, l) => sum + (Number(l.leasedSf) || 0), 0)
  const occupancyPct = property.size ? Math.round((occupiedSf / property.size) * 100) : null

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => navigate('/properties')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-5 transition-colors"
      >
        <ArrowLeft size={15} /> Properties
      </button>

      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
              <Building2 size={24} className={style.text} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-100">
                {property.name || property.address}
              </h1>
              {property.name && property.address && (
                <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                  <MapPin size={13} /> {property.address}
                </p>
              )}
              {property.type && (
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full border font-medium ${style.bg} ${style.text} ${style.border}`}>
                  {TYPE_LABELS[property.type] || property.type}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 btn-secondary text-xs px-3 py-1.5">
              <Edit2 size={13} /> Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-800">
          <div>
            <p className="text-xs text-gray-600 mb-1">Total Size</p>
            <p className="text-sm font-semibold text-gray-200">
              {property.size ? `${Number(property.size).toLocaleString()} SF` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Market Value</p>
            <p className="text-sm font-semibold text-emerald-400">
              {fmt(property.value) || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Occupancy</p>
            <p className="text-sm font-semibold text-gray-200">
              {occupancyPct !== null ? `${occupancyPct}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Annual NOI</p>
            <p className="text-sm font-semibold text-blue-400">
              {totalAnnualRent > 0 ? fmt(totalAnnualRent) : '—'}
            </p>
          </div>
        </div>

        {property.notes && (
          <p className="mt-4 pt-4 border-t border-gray-800 text-sm text-gray-400 whitespace-pre-wrap">
            {property.notes}
          </p>
        )}
      </div>

      {/* Leases */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Layers size={15} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-300">Leases</h2>
          <span className="ml-auto text-xs text-gray-600">{leases.length}</span>
          <button
            onClick={() => setLeaseModal({ mode: 'add' })}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus size={13} /> Add
          </button>
        </div>

        {leases.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-600">No leases yet.</p>
            <button
              onClick={() => setLeaseModal({ mode: 'add' })}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Add first lease
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs text-gray-600 font-medium pb-2 pr-4">Tenant</th>
                  <th className="text-left text-xs text-gray-600 font-medium pb-2 pr-4">Type</th>
                  <th className="text-right text-xs text-gray-600 font-medium pb-2 pr-4">SF</th>
                  <th className="text-right text-xs text-gray-600 font-medium pb-2 pr-4">$/SF/yr</th>
                  <th className="text-left text-xs text-gray-600 font-medium pb-2 pr-4">Expires</th>
                  <th className="text-right text-xs text-gray-600 font-medium pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {leases.map((l) => {
                  const expired = isExpired(l.leaseEnd)
                  const expiringSoon = !expired && isSoonExpiring(l.leaseEnd)
                  return (
                    <tr key={l.id} className="group hover:bg-gray-800/30 transition-colors">
                      <td className="py-2.5 pr-4">
                        <p className="text-gray-200 font-medium">{l.tenantName || '—'}</p>
                        {l.notes && <p className="text-xs text-gray-600 truncate max-w-[140px]">{l.notes}</p>}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-500 text-xs">
                        {LEASE_TYPE_LABELS[l.leaseType] || l.leaseType || '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-300">
                        {l.leasedSf ? Number(l.leasedSf).toLocaleString() : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-300">
                        {l.rentPsf ? `$${Number(l.rentPsf).toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-xs ${expired ? 'text-red-400' : expiringSoon ? 'text-amber-400' : 'text-gray-500'}`}>
                          {fmtDate(l.leaseEnd) || '—'}
                          {expired && ' (expired)'}
                          {expiringSoon && ' (soon)'}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => setLeaseModal({ mode: 'edit', lease: l })}
                          className="opacity-0 group-hover:opacity-100 text-xs text-gray-600 hover:text-gray-300 transition-all"
                        >
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom grid: Linked Contacts + Deals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contacts */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={15} className="text-blue-400" />
            <h2 className="text-sm font-semibold text-gray-300">Tenants / Contacts</h2>
            <span className="ml-auto text-xs text-gray-600">{linkedContacts.length}</span>
          </div>

          {linkedContacts.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-600">No contacts linked.</p>
              <p className="text-xs text-gray-700 mt-1">Link a contact by adding a lease above.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {linkedContacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/contacts/${c.id}`)}
                >
                  <Avatar firstName={c.firstName} lastName={c.lastName} size="sm" src={c.photoUrl} linkedin={c.linkedin} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{c.firstName} {c.lastName}</p>
                    {c.title && <p className="text-xs text-gray-500 truncate">{c.title}</p>}
                  </div>
                  <ChevronRight size={14} className="text-gray-700 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deals */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase size={15} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-gray-300">Related Deals</h2>
            <span className="ml-auto text-xs text-gray-600">{linkedDeals.length}</span>
          </div>

          {linkedDeals.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-600">No deals linked.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedDeals.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors"
                  onClick={() => navigate('/pipeline')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{d.title}</p>
                    <p className="text-xs text-gray-500">{d.stage}</p>
                  </div>
                  {d.value > 0 && (
                    <span className="text-xs text-emerald-400 font-medium flex-shrink-0">
                      {fmt(d.value)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <EditPropertyModal property={property} onClose={() => setShowEdit(false)} onSave={handleSave} />
      )}

      {leaseModal && (
        <LeaseModal
          lease={leaseModal.mode === 'edit' ? leaseModal.lease : null}
          onClose={() => setLeaseModal(null)}
          onSave={handleLeaseSave}
          onDelete={leaseModal.mode === 'edit' ? handleLeaseDelete : undefined}
        />
      )}
    </div>
  )
}
