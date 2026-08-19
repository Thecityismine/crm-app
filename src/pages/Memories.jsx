import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Heart, Archive, Clock, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { useMemories } from '@/hooks/useMemories'
import { useContactStore } from '@/store/contactStore'
import { localDateOnly } from '@/lib/dates'
import MemoryCard from '@/components/memories/MemoryCard'
import MemoryModal from '@/components/memories/MemoryModal'

const KIND_FILTERS = [
  { value: 'all',      label: 'All'      },
  { value: 'personal', label: 'Personal' },
  { value: 'client',   label: 'Client'   },
]

function Chip({ active, onClick, children, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 ${
        active
          ? 'bg-brand-500 text-white border-brand-500'
          : 'bg-gray-900 text-gray-400 border-gray-800 hover:text-gray-200 hover:border-gray-700'
      }`}
    >
      {Icon && <Icon size={13} />}
      {children}
    </button>
  )
}

/** Everything a search should be able to reach, flattened once per memory. */
function searchHaystack(memory, people) {
  return [
    memory.title,
    memory.story,
    memory.place?.label,
    memory.date,
    memory.date && format(localDateOnly(memory.date) || new Date(), 'MMMM d yyyy'),
    ...(memory.tags || []),
    ...people.map((c) => `${c.firstName || ''} ${c.lastName || ''}`),
  ].filter(Boolean).join(' ').toLowerCase()
}

export default function Memories() {
  const { memories, initialized } = useMemories()
  const { contacts } = useContactStore()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [capturing, setCapturing] = useState(false)

  // One pass over contacts, not one per card.
  const contactsById = useMemo(() => {
    const map = new Map()
    for (const c of contacts) map.set(c.id, c)
    return map
  }, [contacts])

  const peopleFor = useMemo(() => {
    const cache = new Map()
    for (const m of memories) {
      cache.set(m.id, (m.contactIds || []).map((id) => contactsById.get(id)).filter(Boolean))
    }
    return cache
  }, [memories, contactsById])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return memories
      .filter((m) => Boolean(m.archived) === showArchived)
      .filter((m) => kind === 'all' || (m.kind || 'personal') === kind)
      .filter((m) => !q || searchHaystack(m, peopleFor.get(m.id) || []).includes(q))
      // The query already sorts by date, but a locally added memory is
      // prepended, so sort again rather than trust arrival order.
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }, [memories, query, kind, showArchived, peopleFor])

  const activeCount = memories.filter((m) => !m.archived).length

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 tracking-tight">Memories</h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeCount} {activeCount === 1 ? 'moment' : 'moments'} in this private timeline
          </p>
        </div>
        <button
          onClick={() => setCapturing(true)}
          className="btn-primary flex items-center gap-1.5 flex-shrink-0"
        >
          <Plus size={15} />
          Capture
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className="input pl-10 rounded-full"
          placeholder="Search titles, stories, dates, or people"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Chip active={!showArchived} onClick={() => setShowArchived(false)} icon={Clock}>
          Timeline
        </Chip>
        <Chip active={showArchived} onClick={() => setShowArchived(true)} icon={Archive}>
          Archived
        </Chip>
        <span className="w-px h-5 bg-gray-800 mx-1" />
        {KIND_FILTERS.map((k) => (
          <Chip key={k.value} active={kind === k.value} onClick={() => setKind(k.value)}>
            {k.label}
          </Chip>
        ))}
      </div>

      {/* Timeline */}
      {visible.length === 0 ? (
        <div className="text-center py-16">
          <Heart size={28} className="mx-auto text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium">
            {!initialized ? 'Loading…'
              : query || kind !== 'all' ? 'Nothing matches those filters'
              : showArchived ? 'Nothing archived'
              : 'No moments yet'}
          </p>
          {!query && kind === 'all' && !showArchived && initialized && (
            <>
              <p className="text-gray-600 text-sm mt-1">
                Moments you capture will appear here, newest first.
              </p>
              <button onClick={() => setCapturing(true)} className="btn-primary mt-4">
                Capture your first moment
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="relative">
          {/* The rail. Sits behind the date markers and stops at the last one. */}
          <span className="absolute left-[27px] top-2 bottom-2 w-px bg-gray-800 hidden sm:block" />

          <div className="space-y-5">
            {visible.map((memory, i) => {
              const day = localDateOnly(memory.date)
              // Only label a date when it changes, so several moments on one
              // day read as one day.
              const isNewDay = i === 0 || visible[i - 1].date !== memory.date

              return (
                <div key={memory.id} className="sm:flex sm:gap-5">
                  <div className="hidden sm:block w-14 flex-shrink-0 pt-1 text-right">
                    {isNewDay && day && (
                      <>
                        <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-widest">
                          {format(day, 'MMM')}
                        </p>
                        <p className="text-xl font-bold text-gray-200 leading-tight">
                          {format(day, 'd')}
                        </p>
                        <p className="text-[10px] text-gray-600">{format(day, 'yyyy')}</p>
                      </>
                    )}
                  </div>

                  <div className="relative flex-1 min-w-0">
                    {isNewDay && (
                      <span className="hidden sm:block absolute -left-[19px] top-2.5 w-2.5 h-2.5 rounded-full bg-brand-500 ring-4 ring-black" />
                    )}
                    {/* Phones lose the gutter, so the date rides on the card */}
                    {day && (
                      <p className="sm:hidden text-[11px] font-semibold text-brand-500 uppercase tracking-widest mb-1.5">
                        {format(day, 'MMM d, yyyy')}
                      </p>
                    )}
                    <MemoryCard
                      memory={memory}
                      people={peopleFor.get(memory.id) || []}
                      onClick={() => navigate(`/memories/${memory.id}`)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {capturing && <MemoryModal onClose={() => setCapturing(false)} />}
    </div>
  )
}
