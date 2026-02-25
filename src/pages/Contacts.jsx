import { useState } from 'react'
import { useContacts } from '@/hooks/useContacts'
import ContactCard from '@/components/contacts/ContactCard'
import ContactForm from '@/components/contacts/ContactForm'
import { createContact } from '@/lib/firebase/contacts'
import { Search, Plus, Users } from 'lucide-react'

const STAGES = ['All', 'Lead', 'Prospect', 'Consultant', 'Active', 'Former Client']

export default function Contacts() {
  const { contacts, loading } = useContacts()
  const [search, setSearch] = useState('')
  const [activeStage, setActiveStage] = useState('All')
  const [showForm, setShowForm] = useState(false)

  const filtered = contacts.filter((c) => {
    const matchesStage = activeStage === 'All' || c.stage === activeStage
    const q = search.toLowerCase()
    const matchesSearch = !q || [c.firstName, c.lastName, c.company, c.email, c.location]
      .some((v) => v?.toLowerCase().includes(q))
    return matchesStage && matchesSearch
  })

  const handleCreate = async (data) => {
    await createContact(data)
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
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Contact
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className="input pl-8"
          placeholder="Search by name, company, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Stage filter tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {STAGES.map((stage) => {
          const count = stage === 'All'
            ? contacts.length
            : contacts.filter((c) => c.stage === stage).length
          return (
            <button
              key={stage}
              onClick={() => setActiveStage(stage)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeStage === stage
                  ? 'bg-gray-700 text-gray-100'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              {stage} {count > 0 && <span className="ml-1 text-gray-500">{count}</span>}
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
            {search || activeStage !== 'All' ? 'No contacts match your filter' : 'No contacts yet'}
          </p>
          {!search && activeStage === 'All' && (
            <p className="text-gray-600 text-sm mt-1">
              Add one manually or import from CSV in{' '}
              <a href="/settings" className="text-brand-500 hover:underline">Settings</a>
            </p>
          )}
        </div>
      )}

      {showForm && (
        <ContactForm
          contact={null}
          onClose={() => setShowForm(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  )
}
