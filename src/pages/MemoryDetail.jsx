import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, MapPin, Archive, Tag, Pencil } from 'lucide-react'
import { format } from 'date-fns'
import { useMemoryStore } from '@/store/memoryStore'
import { useContactStore } from '@/store/contactStore'
import { localDateOnly } from '@/lib/dates'
import Avatar from '@/components/ui/Avatar'
import MemoryModal from '@/components/memories/MemoryModal'

const KIND_STYLES = {
  personal: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  client:   'bg-blue-500/15 text-blue-300 border-blue-500/30',
}

export default function MemoryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { memories } = useMemoryStore()
  const { contacts } = useContactStore()
  const [editing, setEditing] = useState(false)

  const memory = useMemo(() => memories.find((m) => m.id === id), [memories, id])

  const people = useMemo(() => {
    if (!memory) return []
    const byId = new Map(contacts.map((c) => [c.id, c]))
    return (memory.contactIds || []).map((cid) => byId.get(cid)).filter(Boolean)
  }, [memory, contacts])

  if (!memory) {
    return (
      <div className="max-w-4xl py-16 text-center">
        <p className="text-gray-400">That moment isn't here.</p>
        <button onClick={() => navigate('/memories')} className="btn-secondary mt-4">
          Back to Memories
        </button>
      </div>
    )
  }

  const day = localDateOnly(memory.date)

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => navigate('/memories')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4"
      >
        <ArrowLeft size={15} />
        Memories
      </button>

      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-semibold text-gray-100">
          {memory.title || 'Untitled moment'}
        </h1>
        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            title="Edit this moment"
          >
            <Pencil size={15} />
          </button>
          {memory.archived && (
            <span className="px-2 py-0.5 rounded-md border border-gray-700 bg-gray-800 text-gray-400 text-[10px] font-medium uppercase tracking-wide flex items-center gap-1">
              <Archive size={10} />Archived
            </span>
          )}
          {memory.kind && (
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-medium uppercase tracking-wide ${KIND_STYLES[memory.kind] || KIND_STYLES.personal}`}>
              {memory.kind}
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-5">
        {day ? format(day, 'EEEE, MMMM d, yyyy') : 'No date'}
        {memory.place?.label && (
          <span className="inline-flex items-center gap-1 ml-3">
            <MapPin size={12} />
            {memory.place.label}
          </span>
        )}
      </p>

      {memory.photoUrls?.length > 0 && (
        <div className={`grid gap-2 mb-5 ${memory.photoUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {memory.photoUrls.map((url, i) => (
            <img
              key={url + i}
              src={url}
              alt=""
              loading="lazy"
              className="w-full rounded-xl border border-gray-800 object-cover"
              style={{ maxHeight: memory.photoUrls.length === 1 ? '60vh' : '260px' }}
            />
          ))}
        </div>
      )}

      {memory.story && (
        <div className="card p-5 mb-5">
          <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{memory.story}</p>
        </div>
      )}

      {memory.tags?.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <Tag size={13} className="text-gray-600" />
          {memory.tags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-md bg-gray-800 border border-gray-700 text-xs text-gray-400">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="card p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">People</p>
        {people.length === 0 ? (
          <p className="text-sm text-gray-600">No people linked</p>
        ) : (
          <div className="space-y-1">
            {people.map((c) => (
              <Link
                key={c.id}
                to={`/contacts/${c.id}`}
                className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Avatar firstName={c.firstName} lastName={c.lastName} src={c.photoUrl} linkedin={c.linkedin} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 truncate">
                    {`${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed'}
                  </p>
                  {(c.title || c.company) && (
                    <p className="text-xs text-gray-500 truncate">
                      {[c.title, c.company].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {editing && <MemoryModal memory={memory} onClose={() => setEditing(false)} />}
    </div>
  )
}
