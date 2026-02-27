import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCompany, updateCompany, deleteCompany } from '@/lib/firebase/companies'
import { getDeals } from '@/lib/firebase/deals'
import { useContactStore } from '@/store/contactStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Globe, MapPin, Phone, ArrowLeft, Edit2, Trash2, Users, Briefcase, ExternalLink } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import HealthScoreBadge from '@/components/ui/HealthScoreBadge'
import Modal from '@/components/ui/Modal'

const fmt = (n) =>
  n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n) : null

function CompanyAvatar({ name }) {
  const initials = name
    ? name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?'
  const colors = [
    'bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-purple-600',
    'bg-pink-600', 'bg-rose-600', 'bg-orange-600', 'bg-amber-600',
    'bg-teal-600', 'bg-cyan-600', 'bg-emerald-600', 'bg-green-600',
  ]
  const idx = name ? name.charCodeAt(0) % colors.length : 0

  return (
    <div className={`w-14 h-14 rounded-xl ${colors[idx]} flex items-center justify-center flex-shrink-0`}>
      <span className="text-xl font-bold text-white">{initials}</span>
    </div>
  )
}

function EditModal({ company, onClose, onSave, industryOptions }) {
  const [form, setForm] = useState({
    name:     company.name     || '',
    industry: company.industry || '',
    website:  company.website  || '',
    phone:    company.phone    || '',
    location: company.location || '',
    notes:    company.notes    || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
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

  return (
    <Modal title="Edit Company" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Company Name *</label>
          <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Industry</label>
            <select className="input" value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}>
              <option value="">— Select —</option>
              {(industryOptions || []).map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="label">Website</label>
          <input className="input" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function CompanyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { contacts } = useContactStore()
  const { industryOptions } = useSettingsStore()

  const [company, setCompany] = useState(null)
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    Promise.all([getCompany(id), getDeals()])
      .then(([c, d]) => { setCompany(c); setDeals(d) })
      .catch(console.warn)
      .finally(() => setLoading(false))
  }, [id])

  const linkedContacts = useMemo(() => {
    if (!company) return []
    const name = company.name.toLowerCase()
    return contacts.filter((c) => c.company?.toLowerCase() === name)
  }, [contacts, company])

  const linkedDeals = useMemo(() => {
    if (!company) return []
    const contactIds = new Set(linkedContacts.map((c) => c.id))
    return deals.filter((d) => contactIds.has(d.contactId))
  }, [deals, linkedContacts])

  const handleSave = async (data) => {
    await updateCompany(id, data)
    setCompany((c) => ({ ...c, ...data }))
    setShowEdit(false)
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${company.name}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteCompany(id)
      navigate('/companies')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-600 text-sm">Loading...</div>
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <p className="text-gray-500 text-sm">Company not found.</p>
        <button onClick={() => navigate('/companies')} className="mt-3 text-xs text-blue-400 hover:text-blue-300">
          Back to Companies
        </button>
      </div>
    )
  }

  const websiteHref = company.website
    ? (company.website.startsWith('http') ? company.website : `https://${company.website}`)
    : null

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => navigate('/companies')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-5 transition-colors"
      >
        <ArrowLeft size={15} /> Companies
      </button>

      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <CompanyAvatar name={company.name} />
            <div>
              <h1 className="text-2xl font-bold text-gray-100">{company.name}</h1>
              {company.industry && (
                <span className="inline-block mt-1 text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700">
                  {company.industry}
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

        <div className="flex flex-wrap gap-5 mt-5 pt-5 border-t border-gray-800">
          {company.location && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <MapPin size={14} className="text-gray-600" /> {company.location}
            </div>
          )}
          {company.phone && (
            <a href={`tel:${company.phone}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200">
              <Phone size={14} className="text-gray-600" /> {company.phone}
            </a>
          )}
          {websiteHref && (
            <a href={websiteHref} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200">
              <Globe size={14} className="text-gray-600" />
              {company.website.replace(/^https?:\/\//, '')}
              <ExternalLink size={11} className="text-gray-600" />
            </a>
          )}
        </div>

        {company.notes && (
          <p className="mt-4 pt-4 border-t border-gray-800 text-sm text-gray-400 whitespace-pre-wrap">
            {company.notes}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* People */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={15} className="text-blue-400" />
            <h2 className="text-sm font-semibold text-gray-300">People</h2>
            <span className="ml-auto text-xs text-gray-600">{linkedContacts.length}</span>
          </div>

          {linkedContacts.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-600">No contacts linked.</p>
              <p className="text-xs text-gray-700 mt-1">
                Set a contact's company to "{company.name}" to link them here.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {linkedContacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/contacts/${c.id}`)}
                >
                  <Avatar firstName={c.firstName} lastName={c.lastName} size="sm"
                    src={c.photoUrl} linkedin={c.linkedin} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{c.firstName} {c.lastName}</p>
                    {c.title && <p className="text-xs text-gray-500 truncate">{c.title}</p>}
                  </div>
                  <HealthScoreBadge contact={c} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deals */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase size={15} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-gray-300">Deals</h2>
            <span className="ml-auto text-xs text-gray-600">{linkedDeals.length}</span>
          </div>

          {linkedDeals.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-600">No deals linked to this company.</p>
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
        <EditModal company={company} onClose={() => setShowEdit(false)} onSave={handleSave} industryOptions={industryOptions} />
      )}
    </div>
  )
}
