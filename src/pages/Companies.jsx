import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Building2, Trash2, Edit2, Globe, Phone, MapPin, Users, FileText, Search, LayoutGrid, List, Briefcase } from 'lucide-react'
import { getCompanies, createCompany, updateCompany, deleteCompany } from '@/lib/firebase/companies'
import { getDeals } from '@/lib/firebase/deals'
import { useContactStore } from '@/store/contactStore'
import CompanyCard, { CompanyListRow } from '@/components/companies/CompanyCard'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'

const INDUSTRIES = [
  'Real Estate', 'Finance', 'Banking', 'Law', 'Consulting', 'Technology',
  'Healthcare', 'Construction', 'Architecture', 'Insurance', 'Government', 'Other',
]

const OPEN_STAGES = new Set(['Lead', 'Qualified', 'Proposal', 'Negotiation'])

const SORT_OPTIONS = [
  { value: 'name',     label: 'Name A–Z' },
  { value: 'contacts', label: 'Most Contacts' },
  { value: 'deals',    label: 'Most Deals' },
]

// ── Preview modal ──────────────────────────────────────────────────────────
function CompanyPreviewModal({ company, companyContacts, dealCount, onClose, onEdit }) {
  const navigate = useNavigate()

  const handleContactClick = (contactId) => {
    onClose()
    navigate(`/contacts/${contactId}`)
  }

  return (
    <Modal title={company.name} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {company.industry && (
            <span className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2.5 py-1 rounded-full">
              {company.industry}
            </span>
          )}
          {dealCount > 0 && (
            <span className="flex items-center gap-1 text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full">
              <Briefcase size={11} /> {dealCount} open deal{dealCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {company.phone && (
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <Phone size={14} className="text-gray-600 flex-shrink-0" />
              {company.phone}
            </div>
          )}
          {company.location && (
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <MapPin size={14} className="text-gray-600 flex-shrink-0" />
              {company.location}
            </div>
          )}
          {company.website && (
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <Globe size={14} className="text-gray-600 flex-shrink-0" />
              <a
                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-200 truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {company.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
          {company.notes && (
            <div className="flex items-start gap-3 text-sm text-gray-400">
              <FileText size={14} className="text-gray-600 flex-shrink-0 mt-0.5" />
              <p className="whitespace-pre-wrap leading-relaxed">{company.notes}</p>
            </div>
          )}
        </div>

        {companyContacts.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Users size={12} /> {companyContacts.length} Contact{companyContacts.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-1">
              {companyContacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleContactClick(c.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
                >
                  <Avatar firstName={c.firstName} lastName={c.lastName} size="sm" src={c.photoUrl} linkedin={c.linkedin} />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-200 font-medium truncate">{c.firstName} {c.lastName}</p>
                    {c.title && <p className="text-xs text-gray-500 truncate">{c.title}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-gray-800">
          <button onClick={onEdit} className="btn-secondary flex items-center gap-1.5">
            <Edit2 size={13} /> Edit
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Edit / Add modal ───────────────────────────────────────────────────────
function CompanyModal({ company, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    name:     company?.name     || '',
    industry: company?.industry || '',
    website:  company?.website  || '',
    phone:    company?.phone    || '',
    location: company?.location || '',
    notes:    company?.notes    || '',
  })
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onSave({
        name:     form.name.trim(),
        industry: form.industry || null,
        website:  form.website.trim() || null,
        phone:    form.phone.trim() || null,
        location: form.location.trim() || null,
        notes:    form.notes.trim() || null,
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
    <Modal title={company ? 'Edit Company' : 'Add Company'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Company Name *</label>
          <input
            className="input"
            placeholder="e.g. Acme Capital"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Industry</label>
            <select
              className="input"
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
            >
              <option value="">— Select —</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="label">Website</label>
          <input
            className="input"
            placeholder="https://example.com"
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
          />
        </div>

        <div>
          <label className="label">Location</label>
          <input
            className="input"
            placeholder="City, State"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Any notes about this company..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          {company && onDelete && (
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
              {saving ? 'Saving...' : (company ? 'Save Changes' : 'Add Company')}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Companies() {
  const { contacts } = useContactStore()
  const [companies, setCompanies] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [industryFilter, setIndustryFilter] = useState('All')
  const [sortBy, setSortBy] = useState('name')
  const [viewMode, setViewMode] = useState('grid')
  const [modal, setModal] = useState(null) // { mode: 'preview'|'edit'|'add', company? }

  useEffect(() => {
    getCompanies().then(setCompanies).catch(console.warn).finally(() => setLoading(false))
    getDeals().then(setDeals).catch(console.warn)
  }, [])

  // Contact counts per company name (case-insensitive)
  const contactCounts = useMemo(() => {
    const counts = {}
    contacts.forEach((c) => {
      if (c.company) counts[c.company.toLowerCase()] = (counts[c.company.toLowerCase()] || 0) + 1
    })
    return counts
  }, [contacts])

  // Open deal counts per company (via contact's company field)
  const dealCounts = useMemo(() => {
    const counts = {}
    deals.forEach((d) => {
      if (!OPEN_STAGES.has(d.stage)) return
      const contact = contacts.find((c) => c.id === d.contactId)
      if (contact?.company) {
        const key = contact.company.toLowerCase()
        counts[key] = (counts[key] || 0) + 1
      }
    })
    return counts
  }, [deals, contacts])

  // Unique industries for filter tabs
  const industries = useMemo(() => {
    const set = new Set(companies.map((c) => c.industry).filter(Boolean))
    return [...set].sort()
  }, [companies])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let result = companies.filter((c) =>
      (industryFilter === 'All' || c.industry === industryFilter) &&
      (!q || c.name?.toLowerCase().includes(q) || c.industry?.toLowerCase().includes(q) || c.location?.toLowerCase().includes(q))
    )
    if (sortBy === 'contacts') {
      result = [...result].sort((a, b) =>
        (contactCounts[b.name?.toLowerCase()] || 0) - (contactCounts[a.name?.toLowerCase()] || 0)
      )
    } else if (sortBy === 'deals') {
      result = [...result].sort((a, b) =>
        (dealCounts[b.name?.toLowerCase()] || 0) - (dealCounts[a.name?.toLowerCase()] || 0)
      )
    } else {
      result = [...result].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }
    return result
  }, [companies, search, industryFilter, sortBy, contactCounts, dealCounts])

  const handleSave = async (data) => {
    if (modal.mode === 'add') {
      const { id } = await createCompany(data)
      setCompanies((prev) => [...prev, { id, ...data }].sort((a, b) => a.name.localeCompare(b.name)))
    } else {
      await updateCompany(modal.company.id, data)
      setCompanies((prev) => prev.map((c) => c.id === modal.company.id ? { ...c, ...data } : c))
    }
    setModal(null)
  }

  const handleDelete = async () => {
    await deleteCompany(modal.company.id)
    setCompanies((prev) => prev.filter((c) => c.id !== modal.company.id))
    setModal(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Companies</h1>
          <p className="text-gray-500 text-sm mt-0.5">{companies.length} companies</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="btn-primary flex items-center justify-center gap-2 sm:px-4 p-2"
          title="Add Company"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Company</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className="input pl-8"
          placeholder="Search by name, industry, location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Industry filter tabs */}
      {industries.length > 0 && (
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {['All', ...industries].map((ind) => {
            const count = ind === 'All'
              ? companies.length
              : companies.filter((c) => c.industry === ind).length
            return (
              <button
                key={ind}
                onClick={() => setIndustryFilter(ind)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  industryFilter === ind
                    ? 'bg-gray-700 text-gray-100'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                {ind} <span className="ml-1 text-gray-500">{count}</span>
              </button>
            )
          })}
        </div>
      )}

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
          {filtered.length} compan{filtered.length !== 1 ? 'ies' : 'y'}
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
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-600 text-sm">
          Loading companies...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Building2 size={32} className="text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">
            {search || industryFilter !== 'All' ? 'No companies match your filter' : 'No companies yet'}
          </p>
          {!search && industryFilter === 'All' && (
            <button
              onClick={() => setModal({ mode: 'add' })}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300"
            >
              Add your first company
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              contactCount={contactCounts[company.name?.toLowerCase()] || 0}
              dealCount={dealCounts[company.name?.toLowerCase()] || 0}
              onClick={() => setModal({ mode: 'preview', company })}
            />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {filtered.map((company) => (
            <CompanyListRow
              key={company.id}
              company={company}
              contactCount={contactCounts[company.name?.toLowerCase()] || 0}
              dealCount={dealCounts[company.name?.toLowerCase()] || 0}
              onClick={() => setModal({ mode: 'preview', company })}
            />
          ))}
        </div>
      )}

      {modal?.mode === 'preview' && (
        <CompanyPreviewModal
          company={modal.company}
          companyContacts={contacts.filter(
            (c) => c.company?.toLowerCase() === modal.company.name?.toLowerCase()
          )}
          dealCount={dealCounts[modal.company.name?.toLowerCase()] || 0}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ mode: 'edit', company: modal.company })}
        />
      )}
      {(modal?.mode === 'edit' || modal?.mode === 'add') && (
        <CompanyModal
          company={modal.mode === 'edit' ? modal.company : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
