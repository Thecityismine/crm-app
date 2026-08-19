import { useState, useRef, useMemo, useEffect } from 'react'
import {
  ImagePlus, X, Loader2, AlertCircle, MapPin, Search, Trash2, Archive, ArchiveRestore,
} from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import { useContactStore } from '@/store/contactStore'
import { useMemoryStore } from '@/store/memoryStore'
import { uploadImage } from '@/lib/storage'
import { geocodeLocation } from '@/lib/geocode'
import { MEMORY_KINDS } from '@/config/constants'
import {
  createMemory, updateMemory, deleteMemory,
} from '@/lib/firebase/memories'

// Memory photos are the point of the record, so they keep more detail than an
// activity attachment — but still nothing like a 12MP original.
const PHOTO_MAX_SIDE = 2000
const PHOTO_QUALITY = 0.85

/** Today as YYYY-MM-DD in local time — never toISOString, which is UTC. */
function todayLocal() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function MemoryModal({ memory, onClose }) {
  const isEdit = Boolean(memory)
  const { contacts } = useContactStore()
  const store = useMemoryStore()

  const [title, setTitle] = useState(memory?.title || '')
  const [story, setStory] = useState(memory?.story || '')
  const [date, setDate] = useState(memory?.date || todayLocal())
  const [kind, setKind] = useState(memory?.kind || 'personal')
  const [tags, setTags] = useState((memory?.tags || []).join(', '))
  const [archived, setArchived] = useState(Boolean(memory?.archived))

  // Photos already saved stay as URLs; newly picked ones stay as Files until
  // save, so cancelling doesn't leave orphans in Storage.
  const [existingUrls, setExistingUrls] = useState(memory?.photoUrls || [])
  const [newFiles, setNewFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const fileInputRef = useRef()

  const [placeLabel, setPlaceLabel] = useState(memory?.place?.label || '')
  const [coords, setCoords] = useState(
    memory?.place?.lat != null ? { lat: memory.place.lat, lng: memory.place.lng } : null
  )
  const [locating, setLocating] = useState(false)
  const [locateNote, setLocateNote] = useState('')

  const [contactIds, setContactIds] = useState(memory?.contactIds || [])
  const [propertyId] = useState(memory?.propertyId || null)
  const [peopleQuery, setPeopleQuery] = useState('')

  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Object URLs leak if they outlive the component, but they must only be
  // revoked on unmount — revoking them whenever `previews` changed would kill
  // the URLs of every photo already on screen the moment another was added.
  const previewsRef = useRef([])
  useEffect(() => { previewsRef.current = previews }, [previews])
  useEffect(() => () => previewsRef.current.forEach((p) => URL.revokeObjectURL(p)), [])

  const handlePick = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setNewFiles((f) => [...f, ...files])
    setPreviews((p) => [...p, ...files.map((f) => URL.createObjectURL(f))])
    e.target.value = ''
  }

  const removeExisting = (url) => setExistingUrls((u) => u.filter((x) => x !== url))
  const removeNew = (i) => {
    URL.revokeObjectURL(previews[i])
    setNewFiles((f) => f.filter((_, idx) => idx !== i))
    setPreviews((p) => p.filter((_, idx) => idx !== i))
  }

  const locate = async () => {
    const q = placeLabel.trim()
    if (!q) return
    setLocating(true)
    setLocateNote('')
    try {
      const found = await geocodeLocation(q)
      if (found) {
        setCoords(found)
        setLocateNote(`Pinned at ${found.lat.toFixed(3)}, ${found.lng.toFixed(3)}`)
      } else {
        setCoords(null)
        setLocateNote("Couldn't find that one — it'll be saved without a map pin.")
      }
    } catch {
      setCoords(null)
      setLocateNote("Lookup failed — it'll be saved without a map pin.")
    } finally {
      setLocating(false)
    }
  }

  const filteredContacts = useMemo(() => {
    const q = peopleQuery.trim().toLowerCase()
    const list = q
      ? contacts.filter((c) =>
          `${c.firstName || ''} ${c.lastName || ''} ${c.company || ''}`.toLowerCase().includes(q))
      : contacts
    // Capped: the list is a picker, not a directory. Narrow the search instead.
    return list.slice(0, 40)
  }, [contacts, peopleQuery])

  const selectedPeople = useMemo(
    () => contactIds.map((id) => contacts.find((c) => c.id === id)).filter(Boolean),
    [contactIds, contacts]
  )

  const toggleContact = (id) =>
    setContactIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const uploaded = []
      for (let i = 0; i < newFiles.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${newFiles.length}…`)
        uploaded.push(await uploadImage(newFiles[i], {
          dir: 'memory-photos',
          maxSide: PHOTO_MAX_SIDE,
          quality: PHOTO_QUALITY,
        }))
      }
      setProgress('Saving…')

      const payload = {
        title: title.trim(),
        story: story.trim(),
        date,
        kind,
        photoUrls: [...existingUrls, ...uploaded],
        place: placeLabel.trim()
          ? { label: placeLabel.trim(), lat: coords?.lat ?? null, lng: coords?.lng ?? null }
          : null,
        contactIds,
        propertyId,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        archived,
      }

      if (isEdit) {
        await updateMemory(memory.id, payload)
        store.updateMemory(memory.id, payload)
      } else {
        const created = await createMemory(payload)
        store.addMemory(created)
      }
      onClose()
    } catch (err) {
      setError(err?.message ?? 'Save failed. Please try again.')
    } finally {
      setSaving(false)
      setProgress('')
    }
  }

  const handleDelete = async () => {
    if (!confirmingDelete) { setConfirmingDelete(true); return }
    setSaving(true)
    setError('')
    try {
      await deleteMemory(memory.id)
      store.removeMemory(memory.id)
      onClose()
    } catch (err) {
      setError(err?.message ?? 'Delete failed.')
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? 'Edit moment' : 'Capture a moment'} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photos */}
        <div>
          <label className="label">Photos</label>
          <div className="flex flex-wrap gap-2">
            {existingUrls.map((url) => (
              <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-700">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeExisting(url)}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/70 text-gray-300 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {previews.map((src, i) => (
              <div key={src} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-700">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeNew(i)}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/70 text-gray-300 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-lg border border-dashed border-gray-700 text-gray-600 hover:text-gray-400 hover:border-gray-600 flex items-center justify-center transition-colors"
            >
              <ImagePlus size={18} />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePick}
            className="hidden"
          />
        </div>

        <div>
          <label className="label">Title</label>
          <input
            className="input"
            placeholder="Skylar's first day of PreK"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Story</label>
          <textarea
            className="input min-h-[90px] resize-y"
            placeholder="What happened, and what you want to remember about it."
            value={story}
            onChange={(e) => setStory(e.target.value)}
          />
        </div>

        {/* Stacked on phones. A native date input carries an intrinsic minimum
            width, and a 1fr grid column defaults to min-width:auto, so side by
            side at this width the date field pushed straight through the kind
            buttons. min-w-0 lets the columns actually shrink once they fit. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="label">Date</label>
            <input
              className="input min-w-0"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="min-w-0">
            <label className="label">Kind</label>
            <div className="flex gap-2">
              {MEMORY_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border capitalize transition-colors ${
                    kind === k
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Place */}
        <div>
          <label className="label">Place</label>
          <div className="flex gap-2">
            <input
              className="input min-w-0"
              placeholder="Acadmir PreK, Miami FL"
              value={placeLabel}
              onChange={(e) => { setPlaceLabel(e.target.value); setCoords(null); setLocateNote('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); locate() } }}
            />
            <button
              type="button"
              onClick={locate}
              disabled={locating || !placeLabel.trim()}
              className="btn-secondary flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
            >
              {locating ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Locate
            </button>
          </div>
          {locateNote && (
            <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5">
              <MapPin size={11} />{locateNote}
            </p>
          )}
        </div>

        {/* People */}
        <div>
          <label className="label">People</label>
          {selectedPeople.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedPeople.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleContact(c.id)}
                  className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-200 hover:border-gray-600"
                >
                  <Avatar firstName={c.firstName} lastName={c.lastName} src={c.photoUrl} size="sm" />
                  {`${c.firstName || ''} ${c.lastName || ''}`.trim()}
                  <X size={11} className="text-gray-500" />
                </button>
              ))}
            </div>
          )}
          <input
            className="input"
            placeholder="Search contacts to link"
            value={peopleQuery}
            onChange={(e) => setPeopleQuery(e.target.value)}
          />
          {peopleQuery.trim() && (
            <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-gray-800 divide-y divide-gray-800">
              {filteredContacts.length === 0 ? (
                <p className="text-xs text-gray-600 p-3">No matching contacts</p>
              ) : filteredContacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleContact(c.id)}
                  className={`w-full flex items-center gap-2.5 p-2 text-left hover:bg-gray-800 transition-colors ${
                    contactIds.includes(c.id) ? 'bg-gray-800/60' : ''
                  }`}
                >
                  <Avatar firstName={c.firstName} lastName={c.lastName} src={c.photoUrl} size="sm" />
                  <span className="text-sm text-gray-200 truncate">
                    {`${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed'}
                  </span>
                  {contactIds.includes(c.id) && (
                    <span className="ml-auto text-xs text-brand-500 flex-shrink-0">Linked</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label">Tags</label>
          <input
            className="input"
            placeholder="school, family"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 flex items-start gap-2">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {isEdit && (
            <>
              <button
                type="button"
                onClick={() => setArchived((a) => !a)}
                className="btn-secondary flex items-center gap-1.5"
              >
                {archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                {archived ? 'Unarchive' : 'Archive'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  confirmingDelete
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-red-400'
                }`}
              >
                <Trash2 size={14} />
                {confirmingDelete ? 'Really delete?' : 'Delete'}
              </button>
            </>
          )}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {progress && <span className="text-xs text-gray-500">{progress}</span>}
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Save' : 'Capture'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
