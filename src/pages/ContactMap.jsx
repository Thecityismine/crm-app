import { useState, useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { useContactStore } from '@/store/contactStore'
import { auth } from '@/config/firebase'
import { Loader2, RefreshCw } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import 'leaflet/dist/leaflet.css'

const LS_CACHE_KEY = 'crm_geo_cache'

// ── Normalise location strings so "Dallas TX" == "Dallas, TX" == "dallas tx" ──
function normLoc(loc) {
  return loc.toLowerCase().trim().replace(/\s+/g, ' ').replace(/,\s*/g, ', ')
}

// ── localStorage helpers ────────────────────────────────────────────────────
function loadLSCache() {
  try { return JSON.parse(localStorage.getItem(LS_CACHE_KEY) || '{}') } catch { return {} }
}
function saveLSCache(c) {
  try { localStorage.setItem(LS_CACHE_KEY, JSON.stringify(c)) } catch {}
}

// ── Firestore geocache helpers (persist across browsers / devices) ──────────
async function loadFSCache() {
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return {}
    const pid = import.meta.env.VITE_FIREBASE_PROJECT_ID
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/geocache/locations`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return {}
    const doc = await res.json()
    const str = doc.fields?.data?.stringValue
    return str ? JSON.parse(str) : {}
  } catch { return {} }
}

async function saveFSCache(cache) {
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return
    const pid = import.meta.env.VITE_FIREBASE_PROJECT_ID
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/geocache/locations`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { data: { stringValue: JSON.stringify(cache) } } }),
      }
    )
  } catch { /* silent — localStorage is the fallback */ }
}

// ── Nominatim geocoder ──────────────────────────────────────────────────────
async function geocodeLoc(location) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1&addressdetails=0`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.length) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── Build map pins from locMap + cache ──────────────────────────────────────
function buildPins(locMap, cache) {
  const coordMap = {}
  for (const [loc, contacts] of Object.entries(locMap)) {
    const coords = cache[loc]
    if (!coords) continue
    const key = `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`
    if (!coordMap[key]) coordMap[key] = { lat: coords.lat, lng: coords.lng, contacts: [] }
    coordMap[key].contacts.push(...contacts)
  }
  return Object.values(coordMap)
}

// ── Component ───────────────────────────────────────────────────────────────
export default function ContactMap() {
  const { contacts } = useContactStore()
  const navigate = useNavigate()

  const [pins, setPins] = useState([])
  const [geocoding, setGeocoding] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  // Group contacts by normalised location string
  const locMap = useMemo(() => {
    const map = {}
    for (const c of contacts) {
      const raw = c.location?.trim() || c.address?.trim() || ''
      if (!raw) continue
      const loc = normLoc(raw)
      if (!map[loc]) map[loc] = []
      map[loc].push(c)
    }
    return map
  }, [contacts])

  const unlocatedCount = useMemo(
    () => contacts.filter((c) => !c.location?.trim() && !c.address?.trim()).length,
    [contacts]
  )

  // Stable key — only changes when the SET of unique location strings changes,
  // not on every Firestore snapshot that updates contact data in-place.
  const locKeys = useMemo(() => Object.keys(locMap).sort().join('|'), [locMap])

  // Keep locMap accessible inside the effect without it being a dep
  const locMapRef = useRef(locMap)
  useEffect(() => { locMapRef.current = locMap }, [locMap])

  const abortRef = useRef(false)

  useEffect(() => {
    if (!locKeys) return
    abortRef.current = false

    async function run() {
      const current = locMapRef.current

      // 1. Show locally-cached pins immediately (sync)
      const lsCache = loadLSCache()
      setPins(buildPins(current, lsCache))

      // 2. Fetch Firestore cache (async — may have entries from other devices)
      const fsCache = await loadFSCache()
      const cache = { ...fsCache, ...lsCache } // localStorage wins for conflicts
      saveLSCache(cache)
      setPins(buildPins(current, cache))

      const toGeocode = Object.keys(current).filter((loc) => !(loc in cache))
      if (!toGeocode.length) return

      setGeocoding(true)
      setProgress({ done: 0, total: toGeocode.length })

      for (let i = 0; i < toGeocode.length; i++) {
        if (abortRef.current) break
        const loc = toGeocode[i]
        try {
          const coords = await geocodeLoc(loc)
          cache[loc] = coords ?? null
        } catch {
          cache[loc] = null
        }
        saveLSCache(cache)
        setProgress({ done: i + 1, total: toGeocode.length })
        setPins(buildPins(current, cache))

        // Flush to Firestore every 10 entries so progress is preserved cross-device
        if ((i + 1) % 10 === 0 || i === toGeocode.length - 1) {
          saveFSCache(cache) // fire-and-forget
        }

        if (i < toGeocode.length - 1) await sleep(1050) // Nominatim: ≤ 1 req/sec
      }

      setGeocoding(false)
    }

    run()
    return () => { abortRef.current = true }
  }, [locKeys]) // eslint-disable-line react-hooks/exhaustive-deps

  function clearCache() {
    localStorage.removeItem(LS_CACHE_KEY)
    saveFSCache({}) // clear Firestore too
    // Force re-run by temporarily clearing pins; the effect will re-fire next render
    setPins([])
    abortRef.current = true
    setTimeout(() => {
      abortRef.current = false
      const current = locMapRef.current
      const toGeocode = Object.keys(current)
      if (!toGeocode.length) return
      setGeocoding(true)
      setProgress({ done: 0, total: toGeocode.length })
      const cache = {}
      ;(async () => {
        for (let i = 0; i < toGeocode.length; i++) {
          if (abortRef.current) break
          const loc = toGeocode[i]
          try { cache[loc] = (await geocodeLoc(loc)) ?? null } catch { cache[loc] = null }
          saveLSCache(cache)
          setProgress({ done: i + 1, total: toGeocode.length })
          setPins(buildPins(current, cache))
          if ((i + 1) % 10 === 0 || i === toGeocode.length - 1) saveFSCache(cache)
          if (i < toGeocode.length - 1) await sleep(1050)
        }
        setGeocoding(false)
      })()
    }, 100)
  }

  const locatedCount = pins.reduce((s, p) => s + p.contacts.length, 0)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 130px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Contact Map</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {locatedCount} contacts mapped
            {unlocatedCount > 0 && (
              <span className="ml-2 text-gray-700">· {unlocatedCount} missing location</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {geocoding && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={13} className="animate-spin" />
              Geocoding {progress.done}/{progress.total}…
            </div>
          )}
          <button
            onClick={clearCache}
            title="Clear geocode cache and re-fetch"
            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-800 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden border border-gray-800 min-h-0">
        <MapContainer
          center={[30, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%', background: '#111' }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            maxZoom={19}
          />

          {pins.map((pin, i) => {
            const count = pin.contacts.length
            const radius = count >= 10 ? 14 : count >= 5 ? 11 : count >= 2 ? 8 : 6
            return (
              <CircleMarker
                key={i}
                center={[pin.lat, pin.lng]}
                radius={radius}
                pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.85, weight: 1.5 }}
              >
                <Popup className="crm-map-popup" maxWidth={240} minWidth={180}>
                  <div style={{ fontFamily: 'inherit' }}>
                    {pin.contacts.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => navigate(`/contacts/${c.id}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '6px 4px', cursor: 'pointer',
                          borderBottom: '1px solid #1f2937',
                        }}
                      >
                        <Avatar firstName={c.firstName} lastName={c.lastName} size="sm" src={c.photoUrl} linkedin={c.linkedin} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: '13px', color: '#f3f4f6', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.firstName} {c.lastName}
                          </p>
                          {(c.title || c.company) && (
                            <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {[c.title, c.company].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500 opacity-85" />
          1 contact
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="inline-block w-4 h-4 rounded-full bg-blue-500 opacity-85" />
          2–4 contacts
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="inline-block w-5 h-5 rounded-full bg-blue-500 opacity-85" />
          5+ contacts
        </div>
        <span className="ml-auto text-xs text-gray-700">Click a pin · Scroll to zoom</span>
      </div>
    </div>
  )
}
