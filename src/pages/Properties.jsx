import { useState, useEffect, useMemo } from 'react'
import { Plus, Building2, Search, LayoutGrid, List, Map, AlertCircle, Trash2 } from 'lucide-react'
import { getProperties, createProperty, updateProperty, deleteProperty } from '@/lib/firebase/properties'
import { PROPERTY_TYPES } from '@/config/constants'
import PropertyCard from '@/components/properties/PropertyCard'
import PropertyList from '@/components/properties/PropertyList'
import PropertyMap from '@/components/properties/PropertyMap'
import Modal from '@/components/ui/Modal'

const TYPE_LABELS = {
  office: 'Office', retail: 'Retail', industrial: 'Industrial',
  multifamily: 'Multifamily', land: 'Land', mixed_use: 'Mixed Use', other: 'Other',
}

const SORT_OPTIONS = [
  { value: 'name',  label: 'Name A–Z' },
  { value: 'value', label: 'Value ↓' },
  { value: 'size',  label: 'Size ↓' },
  { value: 'type',  label: 'Type' },
  { value: 'added', label: 'Date Added' },
]

function sortProperties(list, sortBy) {
  return [...list].sort((a, b) => {
    switch (sortBy) {
      case 'name':  return (a.name || a.address || '').localeCompare(b.name || b.address || '')
      case 'value': return (Number(b.value) || 0) - (Number(a.value) || 0)
      case 'size':  return (Number(b.size)  || 0) - (Number(a.size)  || 0)
      case 'type':  return (a.type || '').localeCompare(b.type || '')
      case 'added': return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      default: return 0
    }
  })
}

const fmtCompact = (n) =>
  n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n) : '$0'

const fmtSF = (n) =>
  n ? `${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)} SF` : '—'

// Ghost cards shown in empty state to preview the layout
const DEMO_PROPERTIES = [
  { id: '_d1', name: 'One Market Plaza', address: '1 Market St, San Francisco, CA', type: 'office', size: 25000, value: 12500000, location: 'San Francisco, CA' },
  { id: '_d2', name: 'Riverside Industrial Park', address: '450 Industrial Dr, Austin, TX', type: 'industrial', size: 80000, value: 7800000, location: 'Austin, TX' },
  { id: '_d3', name: 'The Meridian', address: '720 W 34th St, New York, NY', type: 'multifamily', size: 45000, value: 32000000, location: 'New York, NY' },
]

// ── Property form modal ──────────────────────────────────────────────────────
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
        name:     form.name.trim()     || null,
        address:  form.address.trim()  || null,
        type:     form.type            || null,
        size:     form.size  ? Number(form.size)  : null,
        value:    form.value ? Number(form.value) : null,
        location: form.location.trim() || null,
        notes:    form.notes.trim()    || null,
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

// ── Main page ────────────────────────────────────────────────────────────────
export default function Properties() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [sortBy, setSortBy] = useState('name')
  const [viewMode, setViewMode] = useState('grid') // grid | list | map
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
      const matchType = typeFilter === 'All' || p.type === typeFilter
      const matchSearch =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q)
      return matchType && matchSearch
    })
  }, [properties, search, typeFilter])

  const sorted = sortProperties(filtered, sortBy)

  // Stats
  const totalValue = properties.reduce((s, p) => s + (Number(p.value) || 0), 0)
  const totalSize  = properties.reduce((s, p) => s + (Number(p.size)  || 0), 0)

  const handleSave = async (data) => {
    if (modal.mode === 'add') {
      const { id } = await createProperty(data)
      setProperties((prev) => [{ id, ...data, createdAt: new Date().toISOString() }, ...prev])
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

  const openEdit = (property) => setModal({ mode: 'edit', property })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Properties</h1>
          <p className="text-gray-500 text-sm mt-0.5">{properties.length} in portfolio</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="btn-primary flex items-center justify-center gap-2 sm:px-4 p-2"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Property</span>
        </button>
      </div>

      {/* Stats strip — only when there are properties */}
      {properties.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="card p-3 text-center">
            <p className="text-xl font-semibold text-gray-100">{properties.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Properties</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xl font-semibold text-emerald-400">{fmtCompact(totalValue)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Portfolio Value</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xl font-semibold text-gray-100">{fmtSF(totalSize)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total SF</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className="input pl-8"
          placeholder="Search by name, address, location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {['All', ...PROPERTY_TYPES].map((t) => {
          const count = t === 'All'
            ? properties.length
            : properties.filter((p) => p.type === t).length
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                typeFilter === t
                  ? 'bg-gray-700 text-gray-100'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              {t === 'All' ? 'All' : TYPE_LABELS[t]}
              {count > 0 && <span className="ml-1 text-gray-500">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Sort + count + view toggle */}
      <div className="flex items-center gap-3 mb-4">
        <select
          className="input w-auto text-xs py-1.5 pr-7"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="text-xs text-gray-600">
          {sorted.length} propert{sorted.length !== 1 ? 'ies' : 'y'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-gray-700 text-gray-200' : 'text-gray-600 hover:text-gray-400'}`}
            title="Grid view"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-gray-700 text-gray-200' : 'text-gray-600 hover:text-gray-400'}`}
            title="List view"
          >
            <List size={15} />
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'map' ? 'bg-gray-700 text-gray-200' : 'text-gray-600 hover:text-gray-400'}`}
            title="Map view"
          >
            <Map size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-600 text-sm">
          Loading properties...
        </div>
      ) : properties.length === 0 ? (
        /* ── Empty state ── */
        <div>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-800 border border-gray-700 mb-4">
              <Building2 size={24} className="text-gray-500" />
            </div>
            <h2 className="text-base font-semibold text-gray-200 mb-1">Build your property portfolio</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Track every asset — offices, retail, industrial, multifamily, and land.
              Link properties to deals and contacts to see your full picture in one place.
            </p>
            <button
              onClick={() => setModal({ mode: 'add' })}
              className="mt-4 btn-primary inline-flex items-center gap-2"
            >
              <Plus size={15} />
              Add your first property
            </button>
          </div>

          {/* Ghost demo cards */}
          <div className="relative">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 opacity-[0.13] pointer-events-none select-none">
              {DEMO_PROPERTIES.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
            <p className="text-center text-xs text-gray-700 mt-3">
              Each property card shows type, address, size, and market value
            </p>
          </div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Building2 size={28} className="text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">No properties match your filters</p>
          <button
            onClick={() => { setSearch(''); setTypeFilter('All') }}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
          >
            Clear filters
          </button>
        </div>
      ) : viewMode === 'map' ? (
        <PropertyMap properties={sorted} />
      ) : viewMode === 'list' ? (
        <PropertyList properties={sorted} onEdit={openEdit} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map((property) => (
            <div key={property.id} className="relative group">
              <PropertyCard property={property} />
              <button
                onClick={(e) => { e.stopPropagation(); openEdit(property) }}
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
