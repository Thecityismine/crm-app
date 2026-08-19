import { auth } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'
import { toFields, fromFields } from './values'

const projectId = () => import.meta.env.VITE_FIREBASE_PROJECT_ID
const docsUrl = () =>
  `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents`
const colUrl = () => `${docsUrl()}/${COLLECTIONS.MEMORIES}`

// One page holds every memory the timeline, calendar and map all read from.
// Raise it when someone actually approaches it — 500 photos-with-captions is
// years of use, and paging would cost the client-side filtering that the rest
// of this app is built on.
const PAGE_LIMIT = 500

async function getIdToken() {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.getIdToken()
}

function currentUid() {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')
  return uid
}

/**
 * A memory's date is a calendar day, not an instant — "Aug 17" is the whole of
 * Aug 17 wherever you are. Stored as 'YYYY-MM-DD' and never as a timestamp, so
 * the month grid can't put a memory on the previous day for anyone west of UTC.
 * See @/lib/dates for the reading side.
 */
function toDateOnly(value) {
  if (!value) return null
  const s = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/** Fill in the fields every consumer assumes exist, whatever the form omitted. */
function normalize(data) {
  const out = { ...data }
  if ('date' in out) out.date = toDateOnly(out.date)
  if ('photoUrls' in out) out.photoUrls = (out.photoUrls || []).filter(Boolean)
  if ('contactIds' in out) out.contactIds = (out.contactIds || []).filter(Boolean)
  if ('tags' in out) out.tags = (out.tags || []).filter(Boolean)
  // A place keeps its label even when nothing could be geocoded — "Grandma's
  // house" is worth recording and no geocoder will ever find it. The map layer
  // filters on coordinates; only a place with neither is dropped.
  if ('place' in out && out.place && !out.place.label && out.place.lat == null) {
    out.place = null
  }
  return out
}

export const getMemories = async () => {
  const token = await getIdToken()
  const uid = currentUid()

  // The ownerId filter is required, not an optimisation: the security rules
  // only grant owned documents, and Firestore rejects a query outright if it
  // could return one the caller can't read.
  const response = await fetch(`${docsUrl()}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: COLLECTIONS.MEMORIES }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'ownerId' },
            op: 'EQUAL',
            value: { stringValue: uid },
          },
        },
        orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
        limit: PAGE_LIMIT,
      },
    }),
  })

  if (!response.ok) {
    const e = await response.json().catch(() => ({}))
    throw new Error(e.error?.message || `Memory query failed (${response.status})`)
  }

  const rows = await response.json()
  return rows
    .filter((r) => r.document)
    .map((r) => ({
      id: r.document.name.split('/').pop(),
      ...fromFields(r.document.fields || {}),
    }))
}

export const getMemory = async (id) => {
  const token = await getIdToken()
  const response = await fetch(`${colUrl()}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (response.status === 404) return null
  if (!response.ok) {
    const e = await response.json().catch(() => ({}))
    throw new Error(e.error?.message || `Get memory failed (${response.status})`)
  }
  const doc = await response.json()
  return { id: doc.name.split('/').pop(), ...fromFields(doc.fields || {}) }
}

export const createMemory = async (data) => {
  const token = await getIdToken()
  const now = new Date().toISOString()

  const fields = toFields({
    kind: 'personal',
    title: '',
    story: '',
    date: null,
    photoUrls: [],
    place: null,
    contactIds: [],
    propertyId: null,
    dealId: null,
    tags: [],
    archived: false,
    ...normalize(data),
    // Last word, always: the rules check this on create, and a memory whose
    // owner came from the form would be a memory someone else could claim.
    ownerId: currentUid(),
  })
  fields.createdAt = { timestampValue: now }
  fields.updatedAt = { timestampValue: now }

  const response = await fetch(colUrl(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!response.ok) {
    const e = await response.json().catch(() => ({}))
    throw new Error(e.error?.message || `Create memory failed (${response.status})`)
  }
  const result = await response.json()
  return { id: result.name?.split('/').pop(), ...fromFields(result.fields || {}) }
}

export const updateMemory = async (id, data) => {
  const token = await getIdToken()
  const clean = normalize(data)
  // ownerId is never part of an update. The rules check both sides, so sending
  // one would at best be a no-op and at worst a rejected write.
  delete clean.ownerId

  const fields = toFields(clean)
  fields.updatedAt = { timestampValue: new Date().toISOString() }

  // Without the mask a PATCH replaces the whole document, dropping every field
  // the caller didn't happen to pass.
  const mask = Object.keys(fields)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&')

  const response = await fetch(`${colUrl()}/${id}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!response.ok) {
    const e = await response.json().catch(() => ({}))
    throw new Error(e.error?.message || `Update memory failed (${response.status})`)
  }
  const result = await response.json()
  return { id, ...fromFields(result.fields || {}) }
}

export const deleteMemory = async (id) => {
  const token = await getIdToken()
  const response = await fetch(`${colUrl()}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const e = await response.json().catch(() => ({}))
    throw new Error(e.error?.message || `Delete memory failed (${response.status})`)
  }
  return {}
}
