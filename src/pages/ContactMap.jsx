import { useState, useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { useContactStore } from '@/store/contactStore'
import { MapPin, Loader2, RefreshCw, X } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import 'leaflet/dist/leaflet.css'

const GEO_CACHE_KEY = 'crm_geo_cache'

function loadCache() {
  try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}') } catch { return {} }
}
function saveCache(cache) {
  try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache)) } catch {}
}

async function geocodeLocation(location) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1&addressdetails=0`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.length) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Build pin groups: cluster contacts at same lat/lng
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

export default function ContactMap() {
  const { contacts } = useContactStore()
  const navigate = useNavigate()

  const [pins, setPins] = useState([])
  const [geocoding, setGeocoding] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [noLocation, setNoLocation] = useState(0)
  const abortRef = useRef(false)
  const ranRef = useRef(false)

  // Group contacts by their location string
  const locMap = useMemo(() => {
    const map = {}
    for (const c of contacts) {
      const loc = (c.location?.trim() || c.address?.trim()) || ''
      if (!loc) continue
      if (!map[loc]) map[loc] = []
      map[loc].push(c)
    }
    return map
  }, [contacts])

  const unlocatedCount = useMemo(() => {
    return contacts.filter((c) => !c.location?.trim() && !c.address?.trim()).length
  }, [contacts])

  useEffect(() => {
    abortRef.current = false
    ranRef.current = false
    runGeocoding()
    return () => { abortRef.current = true }
  }, [locMap])

  async function runGeocoding() {
    if (ranRef.current) return
    ranRef.current = true

    const cache = loadCache()
    const uniqueLocs = Object.keys(locMap)
    const toGeocode = uniqueLocs.filter((loc) => !(loc in cache))

    // Show cached pins immediately
    setPins(buildPins(locMap, cache))
    setNoLocation(unlocatedCount)

    if (!toGeocode.length) return

    setGeocoding(true)
    setProgress({ done: 0, total: toGeocode.length })

    for (let i = 0; i < toGeocode.length; i++) {
      if (abortRef.current) break
      const loc = toGeocode[i]
      try {
        const coords = await geocodeLocation(loc)
        cache[loc] = coords || null
        saveCache(cache)
      } catch {
        cache[loc] = null
        saveCache(cache)
      }
      setProgress({ done: i + 1, total: toGeocode.length })
      setPins(buildPins(locMap, cache))
      if (i < toGeocode.length - 1) await sleep(1100) // Nominatim: 1 req/sec
    }

    setGeocoding(false)
  }

  function clearCache() {
    localStorage.removeItem(GEO_CACHE_KEY)
    ranRef.current = false
    runGeocoding()
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
          {/* CartoDB Dark Matter tiles — free, no API key, dark theme */}
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
                pathOptions={{
                  color: '#1d4ed8',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.85,
                  weight: 1.5,
                }}
              >
                <Popup
                  className="crm-map-popup"
                  maxWidth={240}
                  minWidth={180}
                >
                  <div style={{ fontFamily: 'inherit' }}>
                    {pin.contacts.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => navigate(`/contacts/${c.id}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '6px 4px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #1f2937',
                        }}
                      >
                        <Avatar
                          firstName={c.firstName}
                          lastName={c.lastName}
                          size="sm"
                          src={c.photoUrl}
                          linkedin={c.linkedin}
                        />
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
        <span className="ml-auto text-xs text-gray-700">
          Click a pin to see contacts · Scroll to zoom
        </span>
      </div>
    </div>
  )
}
