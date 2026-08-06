import { useState, useMemo, useCallback } from 'react'
import { useContacts, refreshContacts } from '@/hooks/useContacts'
import { useContactStore } from '@/store/contactStore'
import { useSettingsStore } from '@/store/settingsStore'
import ContactCard, { ContactListRow } from '@/components/contacts/ContactCard'
import ContactForm from '@/components/contacts/ContactForm'
import ScanContactModal from '@/components/contacts/ScanContactModal'
import CSVImportModal from '@/components/contacts/CSVImportModal'
import LogActivityModal from '@/components/activities/LogActivityModal'
import { createContact, updateContact } from '@/lib/firebase/contacts'
import { logActivity } from '@/lib/firebase/activities'
import { getHealthScore } from '@/lib/healthScore'
import FilterControls from '@/components/filters/FilterControls'
import { matchesFilters, optionsFromSettings, valuesFromField, hasActiveFilters } from '@/lib/filters'
import { Search, Plus, ScanLine, Users, FileUp, LayoutGrid, List } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'name',           label: 'Name A–Z' },
  { value: 'company',        label: 'Company' },
  { value: 'last_contacted', label: 'Last Contacted' },
  { value: 'health',         label: 'Health Score' },
  { value: 'date_added',     label: 'Date Added' },
]

const HEALTH_ORDER = { cold: 0, overdue: 1, due_soon: 2, active: 3, unknown: 4 }

const NAME_SUFFIXES = new Set([
  'jr','sr','ii','iii','iv','v','ra','aia','pe','pmp','cpa','phd','md','esq','leed',
])

function familyNameKey(c) {
  const full  = `${c.firstName || ''} ${c.lastName || ''}`.trim()
  const words = full.split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  for (let i = words.length - 1; i >= 0; i--) {
    const alpha = words[i].replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '')
    if (alpha.length > 1 && !NAME_SUFFIXES.has(alpha.toLowerCase())) {
      return alpha
    }
  }
  return words[0].replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '') || ''
}

function sortContacts(contacts, sortBy) {
  return [...contacts].sort((a, b) => {
    switch (sortBy) {
      case 'name': {
        const aKey = `${a.firstName || ''} ${familyNameKey(a)}`.trim()
        const bKey = `${b.firstName || ''} ${familyNameKey(b)}`.trim()
        return aKey.localeCompare(bKey, undefined, { sensitivity: 'base' })
      }
      case 'company': {
        const ac = a.company?.trim() || '￿'
        const bc = b.company?.trim() || '￿'
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

const UNASSIGNED = 'Unassigned'

const hasEmail = (c) => Boolean(c.email || c.emails?.some(Boolean))
const hasPhone = (c) => Boolean(c.mobilePhone || c.officePhone)
const hasAddress = (c) => Boolean(c.address || c.location)

const INFO_PREDICATES = {
  email:   hasEmail,
  phone:   hasPhone,
  address: hasAddress,
  missing: (c) => !hasEmail(c) && !hasPhone(c),
}

const INFO_LABELS = {
  email:   'Has email',
  phone:   'Has phone number',
  address: 'Has address',
  missing: 'Missing contact information',
}
const COMMUNICATION_TYPES = new Set(['call', 'email', 'meeting', 'sms', 'note'])

export default function Contacts() {
  const { contacts } = useContacts()
  const relationshipOptions = useSettingsStore((s) => s.relationshipOptions)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ relationship: [], info: [], location: '', company: '' })
  const [sortBy, setSortBy] = useState('name')
  const [viewMode, setViewMode] = useState('grid')
  const [showForm, setShowForm] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [scannedContact, setScannedContact] = useState(null)
  const [loggingContact, setLoggingContact] = useState(null)


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

  const handleLogSave = async (data) => {
    await logActivity(loggingContact.id, data)
    if (COMMUNICATION_TYPES.has(data.type)) {
      await updateContact(loggingContact.id, { lastCommunication: data.occurredAt })
      useContactStore.getState().updateContact(loggingContact.id, { lastCommunication: data.occurredAt })
    }
    refreshContacts()
    setLoggingContact(null)
  }

  // Options are tallied in one pass each and exclude values nobody matches —
  // a filter that returns nothing is a dead end. Relationships come from the
  // Relationship Types list in Settings, in that order, so editing the list
  // there is what changes the filter here. They're multi-select so related
  // trades (Architect + MEP Engineer) can be viewed together.
  const facets = useMemo(() => [
    {
      key: 'relationship',
      label: 'Relationship',
      type: 'multi',
      options: optionsFromSettings(contacts, 'relationship', relationshipOptions, {
        unassignedValue: UNASSIGNED,
      }),
      match: (c, sel) =>
        sel.some((v) => (v === UNASSIGNED ? !c.relationship : c.relationship === v)),
    },
    {
      key: 'info',
      label: 'Contact information',
      type: 'multi',
      options: Object.keys(INFO_PREDICATES)
        .map((key) => ({
          value: key,
          label: INFO_LABELS[key],
          count: contacts.filter(INFO_PREDICATES[key]).length,
        }))
        .filter((o) => o.count > 0),
      match: (c, sel) => sel.some((v) => INFO_PREDICATES[v](c)),
    },
    {
      key: 'location',
      label: 'Location',
      type: 'select',
      options: valuesFromField(contacts, 'location'),
      match: (c, v) => c.location === v,
    },
    {
      key: 'company',
      label: 'Company',
      type: 'select',
      options: valuesFromField(contacts, 'company'),
      match: (c, v) => c.company === v,
    },
  ], [contacts, relationshipOptions])

  const matchesSearch = (c) => {
    const q = search.toLowerCase()
    return !q || [c.firstName, c.lastName, c.company, c.email, c.location, c.relationship]
      .some((v) => v?.toLowerCase().includes(q))
  }

  const filtered = useMemo(
    () => contacts.filter((c) => matchesSearch(c) && matchesFilters(c, facets, filters)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contacts, search, facets, filters]
  )

  const sorted = sortContacts(filtered, sortBy)

  // Previews the result count on the sheet's apply button without committing.
  const countFor = useCallback(
    (draft) => contacts.filter((c) => matchesSearch(c) && matchesFilters(c, facets, draft)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contacts, search, facets]
  )

  return (
    <div>
      {/* Page header: title on left, actions on right */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Contacts</h1>
          <p className="text-gray-500 text-sm mt-0.5">{contacts.length} total</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowImport(true)}
            className="btn-secondary p-2"
            title="Import from CSV"
          >
            <FileUp size={15} />
          </button>
          <button
            onClick={() => setShowScan(true)}
            className="btn-secondary p-2"
            title="Scan contact from image"
          >
            <ScanLine size={15} />
          </button>
          <button
            onClick={() => { setScannedContact(null); setShowForm(true) }}
            className="btn-primary flex items-center gap-2 px-4"
            title="Add Contact"
          >
            <Plus size={16} />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className="input pl-8"
          placeholder="Search by name, company, email, relationship..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <FilterControls
        facets={facets}
        value={filters}
        onChange={setFilters}
        quickFacetKey="relationship"
        totalCount={contacts.length}
        resultCount={sorted.length}
        countFor={countFor}
        noun="contacts"
        title="Filter contacts"
        sortControl={
          <select
            className="input w-auto text-xs py-1.5 pr-7"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        }
        viewControl={
          <>
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
          </>
        }
      />

      {/* Contacts */}
      {sorted.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {sorted.map((contact) => (
              <ContactCard key={contact.id} contact={contact} onLog={setLoggingContact} />
            ))}
          </div>
        ) : (
          <div className="card overflow-hidden">
            {sorted.map((contact) => (
              <ContactListRow key={contact.id} contact={contact} onLog={setLoggingContact} />
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Users size={36} className="text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium">
            {search || hasActiveFilters(filters) ? 'No contacts match your filter' : 'No contacts yet'}
          </p>
          {!search && !hasActiveFilters(filters) && (
            <p className="text-gray-600 text-sm mt-1">
              Add one manually or{' '}
              <button onClick={() => setShowImport(true)} className="text-blue-400 hover:text-blue-300 transition-colors">
                import from CSV
              </button>
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

      {loggingContact && (
        <LogActivityModal
          onClose={() => setLoggingContact(null)}
          onSave={handleLogSave}
        />
      )}
    </div>
  )
}
