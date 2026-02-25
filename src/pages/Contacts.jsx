import { useState } from 'react'
import { useContacts } from '@/hooks/useContacts'
import { useSettingsStore } from '@/store/settingsStore'
import ContactCard from '@/components/contacts/ContactCard'
import ContactForm from '@/components/contacts/ContactForm'
import ScanContactModal from '@/components/contacts/ScanContactModal'
import { createContact } from '@/lib/firebase/contacts'
import { Search, Plus, ScanLine, Users } from 'lucide-react'

export default function Contacts() {
  const { contacts, loading } = useContacts()
  const relationshipOptions = useSettingsStore((s) => s.relationshipOptions)
  const [search, setSearch] = useState('')
  const [activeRel, setActiveRel] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [scannedContact, setScannedContact] = useState(null)

  const filtered = contacts.filter((c) => {
    const matchesRel = activeRel === 'All' || c.relationship === activeRel
    const q = search.toLowerCase()
    const matchesSearch = !q || [c.firstName, c.lastName, c.company, c.email, c.location, c.relationship]
      .some((v) => v?.toLowerCase().includes(q))
    return matchesRel && matchesSearch
  })

  const handleCreate = async (data) => {
    await createContact(data)
  }

  // Called when user clicks "Review & Save" in the scan modal
  const handleScanExtracted = (extractedData) => {
    setScannedContact(extractedData)
    setShowForm(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading contacts...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Contacts</h1>
          <p className="text-gray-500 text-sm mt-0.5">{contacts.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScan(true)}
            className="btn-secondary flex items-center gap-2"
            title="Scan contact from image"
          >
            <ScanLine size={15} /> Scan
          </button>
          <button
            onClick={() => { setScannedContact(null); setShowForm(true) }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Add Contact
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className="input pl-8"
          placeholder="Search by name, company, email, relationship..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Relationship filter tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {['All', ...relationshipOptions].map((rel) => {
          const count = rel === 'All'
            ? contacts.length
            : contacts.filter((c) => c.relationship === rel).length
          return (
            <button
              key={rel}
              onClick={() => setActiveRel(rel)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeRel === rel
                  ? 'bg-gray-700 text-gray-100'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              {rel} {count > 0 && <span className="ml-1 text-gray-500">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Users size={36} className="text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium">
            {search || activeRel !== 'All' ? 'No contacts match your filter' : 'No contacts yet'}
          </p>
          {!search && activeRel === 'All' && (
            <p className="text-gray-600 text-sm mt-1">
              Add one manually or import from CSV in{' '}
              <a href="/settings" className="text-brand-500 hover:underline">Settings</a>
            </p>
          )}
        </div>
      )}

      {/* Scan modal */}
      {showScan && (
        <ScanContactModal
          onClose={() => setShowScan(false)}
          onExtracted={handleScanExtracted}
        />
      )}

      {/* Contact form — pre-filled with scanned data if available */}
      {showForm && (
        <ContactForm
          contact={scannedContact}
          onClose={() => { setShowForm(false); setScannedContact(null) }}
          onSave={handleCreate}
        />
      )}
    </div>
  )
}
