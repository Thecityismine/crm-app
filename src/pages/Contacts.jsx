import { useState } from 'react'
import { useContacts, refreshContacts } from '@/hooks/useContacts'
import { useContactStore } from '@/store/contactStore'
import { useSettingsStore } from '@/store/settingsStore'
import ContactCard, { ContactListRow } from '@/components/contacts/ContactCard'
import ContactForm from '@/components/contacts/ContactForm'
import ScanContactModal from '@/components/contacts/ScanContactModal'
import CSVImportModal from '@/components/contacts/CSVImportModal'
import { createContact } from '@/lib/firebase/contacts'
import { getHealthScore } from '@/lib/healthScore'
import { Search, Plus, ScanLine, Users, FileUp, LayoutGrid, List } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'name',           label: 'Name A–Z' },
  { value: 'company',        label: 'Company' },
  { value: 'last_contacted', label: 'Last Contacted' },
  { value: 'health',         label: 'Health Score' },
  { value: 'date_added',     label: 'Date Added' },
]

const HEALTH_ORDER = { cold: 0, overdue: 1, due_soon: 2, active: 3, unknown: 4 }

// Known name suffixes to skip when finding the true family name
const NAME_SUFFIXES = new Set([
  'jr','sr','ii','iii','iv','v','ra','aia','pe','pmp','cpa','phd','md','esq','leed',
])

// Extract the true family name from a contact for sorting.
// Handles middle initials ("Norman A. Glavas" → "Glavas"),
// nicknames ("Gerald 'Jerry' Luczka" → "Luczka"),
// suffixes ("Norman A. Glavas, RA" → "Glavas"), and
// parenthetical nicknames ("Robert (Bob) Orban" → "Orban").
function familyNameKey(c) {
  const full  = `${c.firstName || ''} ${c.lastName || ''}`.trim()
  const words = full.split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  // Scan backwards to find the last real name word
  for (let i = words.length - 1; i >= 0; i--) {
    const alpha = words[i].replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '')
    if (alpha.length > 1 && !NAME_SUFFIXES.has(alpha.toLowerCase())) {
      return alpha  // strip punctuation, keep letters only
    }
  }
  return words[0].replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '') || ''
}

function sortContacts(contacts, sortBy) {
  return [...contacts].sort((a, b) => {
    switch (sortBy) {
      case 'name': {
        const aKey = `${familyNameKey(a)} ${a.firstName || ''}`.trim()
        const bKey = `${familyNameKey(b)} ${b.firstName || ''}`.trim()
        return aKey.localeCompare(bKey, undefined, { sensitivity: 'base' })
      }
      case 'company': {
        const ac = a.company?.trim() || '\uffff'  // push blanks to end
        const bc = b.company?.trim() || '\uffff'
        return ac.localeCompare(bc, undefined, { sensitivity: 'base' })
      }
      case 'last_contacted': {
        const ad = a.lastCommunication ? new Date(a.lastCommunication) : new Date(0)
        const bd = b.lastCommunication ? new Date(b.lastCommunication) : new Date(0)
        return bd - ad
      }
      case 'health': {
        const as_ = HEALTH_ORDER[getHealthScore(a).score] ?? 4
        const bs_ = HEALTH_ORDER[getHealthScore(b).score] ?? 4
        return as_ - bs_
      }
      case 'date_added':
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      default:
        return 0
    }
  })
}

export default function Contacts() {
  const { contacts } = useContacts()
  const relationshipOptions = useSettingsStore((s) => s.relationshipOptions)
  const [search, setSearch] = useState('')
  const [activeRel, setActiveRel] = useState('All')
  const [sortBy, setSortBy] = useState('name')
  const [viewMode, setViewMode] = useState('grid')
  const [showForm, setShowForm] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [scannedContact, setScannedContact] = useState(null)

  const filtered = contacts.filter((c) => {
    const matchesRel = activeRel === 'All' || c.relationship === activeRel
    const q = search.toLowerCase()
    const matchesSearch = !q || [c.firstName, c.lastName, c.company, c.email, c.location, c.relationship]
      .some((v) => v?.toLowerCase().includes(q))
    return matchesRel && matchesSearch
  })

  const sorted = sortContacts(filtered, sortBy)

  const { addContact } = useContactStore()

  const handleCreate = async (data) => {
    const result = await createContact(data)
    if (result?.id) {
      addContact({ id: result.id, ...data, createdAt: new Date().toISOString() })
    }
    refreshContacts()
  }

  const handleScanExtracted = (extractedData) => {
    setScannedContact(extractedData)
    setShowForm(true)
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
            onClick={() => setShowImport(true)}
            className="btn-secondary flex items-center justify-center gap-2 sm:px-4 p-2"
            title="Import from CSV"
          >
            <FileUp size={15} />
            <span className="hidden sm:inline">Import</span>
          </button>
          <button
            onClick={() => setShowScan(true)}
            className="btn-secondary flex items-center justify-center gap-2 sm:px-4 p-2"
            title="Scan contact from image"
          >
            <ScanLine size={15} />
            <span className="hidden sm:inline">Scan</span>
          </button>
          <button
            onClick={() => { setScannedContact(null); setShowForm(true) }}
            className="btn-primary flex items-center justify-center gap-2 sm:px-4 p-2"
            title="Add Contact"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add Contact</span>
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
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
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
          {sorted.length} contact{sorted.length !== 1 ? 's' : ''}
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

      {/* Contacts */}
      {sorted.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sorted.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        ) : (
          <div className="card overflow-hidden">
            {sorted.map((contact) => (
              <ContactListRow key={contact.id} contact={contact} />
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Users size={36} className="text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium">
            {search || activeRel !== 'All' ? 'No contacts match your filter' : 'No contacts yet'}
          </p>
          {!search && activeRel === 'All' && (
            <p className="text-gray-600 text-sm mt-1">
              Add one manually or{' '}
              <button onClick={() => setShowImport(true)} className="text-brand-500 hover:underline">import from CSV</button>
            </p>
          )}
        </div>
      )}

      {showImport && (
        <CSVImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { refreshContacts(); setShowImport(false) }}
        />
      )}

      {showScan && (
        <ScanContactModal
          onClose={() => setShowScan(false)}
          onExtracted={handleScanExtracted}
        />
      )}

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
