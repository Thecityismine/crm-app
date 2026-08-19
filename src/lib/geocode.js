// Nominatim geocoding with a two-tier cache.
//
// Several surfaces need the same thing: turn a pile of free-text locations into
// map pins without hammering Nominatim, which allows one request per second.
// This logic used to live twice over — once in the contact map, once in the
// property map — each with its own cache key, its own rate-limit loop and its
// own drift. Adding a memories layer would have made three copies. It lives
// here now; the React glue that drives it is in @/hooks/useGeocodedPins.

import { auth } from '@/config/firebase'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

// Nominatim's usage policy is one request per second. Stay just under.
export const RATE_LIMIT_MS = 1100

// Pins within ~100m of each other collapse into one marker.
const PIN_PRECISION = 3

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Normalise a location string so "Dallas TX", "Dallas, TX" and "dallas  tx"
 * share a single cache entry instead of costing three geocode requests.
 *
 * Punctuation is dropped rather than tidied. The earlier version only
 * normalised the spacing around commas, which left "dallas tx" and
 * "dallas, tx" as separate keys — the exact pair it was written to merge —
 * so the same city was geocoded twice and drew two pins a few metres apart.
 *
 * Only use this for coarse locations (a contact's city). Street addresses are
 * specific enough that normalising them would merge distinct buildings.
 */
export function normLoc(loc) {
  return String(loc)
    .toLowerCase()
    .replace(/[.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Resolve one location string. Returns { lat, lng }, or null when unfound. */
export async function geocodeLocation(query) {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.length) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

// ── localStorage tier ───────────────────────────────────────────────────────
// Synchronous, so cached pins can paint on the first render.

export function loadLocalCache(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}

export function saveLocalCache(key, cache) {
  // Best-effort: private mode and quota exhaustion are both survivable, the
  // remote tier and a re-geocode cover us.
  try { localStorage.setItem(key, JSON.stringify(cache)) } catch { /* empty */ }
}

export function clearLocalCache(key) {
  try { localStorage.removeItem(key) } catch { /* empty */ }
}

// ── Firestore tier ──────────────────────────────────────────────────────────
// Optional, and only worth it for caches expensive enough to be worth sharing
// across devices. Stored as one JSON blob per doc under geocache/{docId}.

const remoteUrl = (docId) =>
  `https://firestore.googleapis.com/v1/projects/${import.meta.env.VITE_FIREBASE_PROJECT_ID}` +
  `/databases/(default)/documents/geocache/${docId}`

export async function loadRemoteCache(docId) {
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return {}
    const res = await fetch(remoteUrl(docId), { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return {}
    const doc = await res.json()
    const str = doc.fields?.data?.stringValue
    return str ? JSON.parse(str) : {}
  } catch { return {} }
}

export async function saveRemoteCache(docId, cache) {
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return
    await fetch(remoteUrl(docId), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { data: { stringValue: JSON.stringify(cache) } } }),
    })
  } catch { /* silent — localStorage is the fallback */ }
}

// ── Pin building ────────────────────────────────────────────────────────────

/**
 * Turn { location: [item, ...] } plus a resolved cache into map pins, merging
 * everything that lands on the same spot into one marker.
 *
 * Callers get `items` back rather than a domain-specific name, because the same
 * grouping serves contacts, properties and memories.
 */
export function buildPins(locMap, cache) {
  const byCoord = {}
  for (const [loc, items] of Object.entries(locMap)) {
    const coords = cache[loc]
    if (!coords) continue
    const key = `${coords.lat.toFixed(PIN_PRECISION)},${coords.lng.toFixed(PIN_PRECISION)}`
    if (!byCoord[key]) byCoord[key] = { lat: coords.lat, lng: coords.lng, items: [] }
    byCoord[key].items.push(...items)
  }
  return Object.values(byCoord)
}
