import { useState, useEffect, useMemo } from 'react'
import { Plus, Building2 } from 'lucide-react'
import { getProperties, createProperty, updateProperty, deleteProperty } from '@/lib/firebase/properties'
import { PROPERTY_TYPES } from '@/config/constants'
import PropertyCard from '@/components/properties/PropertyCard'
import Modal from '@/components/ui/Modal'
import { AlertCircle, Trash2 } from 'lucide-react'

const TYPE_LABELS = {
  office: 'Office', retail: 'Retail', industrial: 'Industrial',
  multifamily: 'Multifamily', land: 'Land', mixed_use: 'Mixed Use', other: 'Other',
}

function PropertyModal({ property, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    name:     property?.name     || '',
    address:  property?.address  || '',
    type:     property?.type     || '',
    size:     property?.size     || '',
    value:    property?.value    || '',
    location: property?.location || '',
    notes:    property?.notes    || '',
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
        name:     form.name.trim() || null,
        address:  form.address.trim() || null,
        type:     form.type || null,
        size:     form.size ? Number(form.size) : null,
        value:    form.value ? Number(form.value) : null,
        location: form.location.trim() || null,
        notes:    form.notes.trim() || null,
      })
    } catch (err) {
      setError(err?.message ?? 'Save failed. Please try again.')
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
    <Modal title={property ? 'Edit Property' : 'Add Property'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Property Name</label>
          <input className="input" placeholder="e.g. One Market Plaza" value={form.name} onChange={set('name')} />
        </div>

        <div>
          <label className="label">Address *</label>
          <input className="input" placeholder="123 Main St, San Francisco, CA 94105" value={form.address} onChange={set('address')} required />
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
            <input className="input" type="number" placeholder="25000" value={form.size} onChange={set('size')} min="0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Market Value ($)</label>
            <input className="input" type="number" placeholder="5000000" value={form.value} onChange={set('value')} min="0" />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" placeholder="City, State" value={form.location} onChange={set('location')} />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Any notes about this property..."
            value={form.notes}
            onChange={set('notes')}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          {property && onDelete && (
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
              {saving ? 'Saving...' : property ? 'Save Changes' : 'Add Property'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function Properties() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modal, setModal] = useState(null)

  useEffect(() => {
    getProperties()
      .then(setProperties)
      .catch(console.warn)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return properties.filter((p) => {
      const matchSearch =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q)
      const matchType = !typeFilter || p.type === typeFilter
      return matchSearch && matchType
    })
  }, [properties, search, typeFilter])

  const handleSave = async (data) => {
    if (modal.mode === 'add') {
      const { id } = await createProperty(data)
      setProperties((prev) => [{ id, ...data }, ...prev])
    } else {
      await updateProperty(modal.property.id, data)
      setProperties((prev) =>
        prev.map((p) => p.id === modal.property.id ? { ...p, ...data } : p)
      )
    }
    setModal(null)
  }

  const handleDelete = async () => {
    await deleteProperty(modal.property.id)
    setProperties((prev) => prev.filter((p) => p.id !== modal.property.id))
    setModal(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Properties</h1>
          <p className="text-gray-500 text-sm mt-0.5">{properties.length} properties</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="btn-primary flex items-center justify-center gap-2 sm:px-4 p-2"
          title="Add Property"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Property</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          className="input max-w-xs"
          placeholder="Search by name, address, location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-auto"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-600 text-sm">
          Loading properties...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Building2 size={32} className="text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">
            {search || typeFilter ? 'No properties match your filters' : 'No properties yet'}
          </p>
          {!search && !typeFilter && (
            <button
              onClick={() => setModal({ mode: 'add' })}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300"
            >
              Add your first property
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((property) => (
            <div key={property.id} className="relative group">
              <PropertyCard property={property} />
              <button
                onClick={(e) => { e.stopPropagation(); setModal({ mode: 'edit', property }) }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-xs text-gray-600 hover:text-gray-300 bg-gray-800 border border-gray-700 px-2 py-1 rounded-lg transition-all"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <PropertyModal
          property={modal.mode === 'edit' ? modal.property : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
