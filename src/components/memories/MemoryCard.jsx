import { MapPin, Users, Image as ImageIcon, Archive } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'

const KIND_STYLES = {
  personal: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  client:   'bg-blue-500/15 text-blue-300 border-blue-500/30',
}

/**
 * One moment on the timeline. `people` is resolved by the caller rather than
 * looked up here, so a list of fifty cards doesn't run fifty scans of the
 * contact store.
 */
export default function MemoryCard({ memory, people = [], onClick }) {
  const photo = memory.photoUrls?.[0]
  const extraPhotos = Math.max((memory.photoUrls?.length || 0) - 1, 0)

  return (
    <button
      type="button"
      onClick={onClick}
      className="card w-full text-left overflow-hidden hover:border-gray-700 transition-colors group"
    >
      {photo ? (
        <div className="relative aspect-[16/10] bg-gray-800 overflow-hidden">
          <img
            src={photo}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
          {extraPhotos > 0 && (
            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[11px] font-medium flex items-center gap-1">
              <ImageIcon size={11} />+{extraPhotos}
            </span>
          )}
          {memory.archived && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-gray-300 text-[11px] font-medium flex items-center gap-1">
              <Archive size={11} />Archived
            </span>
          )}
        </div>
      ) : (
        <div className="aspect-[16/5] bg-gray-800/50 flex items-center justify-center">
          <ImageIcon size={20} className="text-gray-700" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-gray-100 leading-snug">
            {memory.title || 'Untitled moment'}
          </h3>
          {memory.kind && (
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-medium uppercase tracking-wide flex-shrink-0 ${KIND_STYLES[memory.kind] || KIND_STYLES.personal}`}>
              {memory.kind}
            </span>
          )}
        </div>

        {memory.story && (
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{memory.story}</p>
        )}

        {memory.place?.label && (
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
            <MapPin size={12} className="flex-shrink-0" />
            <span className="truncate">{memory.place.label}</span>
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          {people.length > 0 ? (
            <>
              <div className="flex -space-x-2">
                {people.slice(0, 4).map((c) => (
                  <Avatar
                    key={c.id}
                    firstName={c.firstName}
                    lastName={c.lastName}
                    src={c.photoUrl}
                    linkedin={c.linkedin}
                    size="sm"
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">
                {people.length === 1
                  ? `${people[0].firstName || ''} ${people[0].lastName || ''}`.trim()
                  : `${people.length} people`}
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-600 flex items-center gap-1.5">
              <Users size={12} />No people linked
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
