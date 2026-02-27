import { useState, useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { Building2, Loader2, RefreshCw } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

const GEO_CACHE_KEY = 'crm_property_geo_cache'

function loadCache() {
  try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}') } catch { return {} }
}
function saveCache(cache) {
  try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache)) } catch {}
}

async function geocodeLocation(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.length) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Color per property type — full strings for Tailwind JIT
const TYPE_COLORS = {
  office:      { stroke: '#2563eb', fill: '#60a5fa' },
  retail:      { stroke: '#b45309', fill: '#fbbf24' },
  industrial:  { stroke: '#c2410c', fill: '#fb923c' },
  multifamily: { stroke: '#6d28d9', fill: '#a78bfa' },
  land:        { stroke: '#047857', fill: '#34d399' },
  mixed_use:   { stroke: '#0e7490', fill: '#22d3ee' },
  other:       { stroke: '#4b5563', fill: '#9ca3af' },
}

const TYPE_LABELS = {
  office: 'Office', retail: 'Retail', industrial: 'Industrial',
  multifamily: 'Multifamily', land: 'Land', mixed_use: 'Mixed Use', other: 'Other',
}

const fmtCompact = (n) =>
  n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n) : null

function buildPins(locMap, cache) {
  const coordMap = {}
  for (const [loc, props] of Object.entries(locMap)) {
    const coords = cache[loc]
    if (!coords) continue
    const key = `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`
    if (!coordMap[key]) coordMap[key] = { lat: coords.lat, lng: coords.lng, properties: [] }
    coordMap[key].properties.push(...props)
  }
  return Object.values(coordMap)
}

export default function PropertyMap({ properties }) {
  const navigate = useNavigate()
  const [pins, setPins] = useState([])
  const [geocoding, setGeocoding] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const abortRef = useRef(false)
  const ranRef = useRef(false)

  // Group by best available address string
  const locMap = useMemo(() => {
    const map = {}
    for (const p of properties) {
      const loc = p.address?.trim() || p.location?.trim() || ''
      if (!loc) continue
      if (!map[loc]) map[loc] = []
      map[loc].push(p)
    }
    return map
  }, [properties])

  const unlocatedCount = useMemo(
    () => properties.filter((p) => !p.address?.trim() && !p.location?.trim()).length,
    [properties]
  )

  useEffect(() => {
    abortRef.current = false
    ranRef.current = false
    run()
    return () => { abortRef.current = true }
  }, [locMap])

  async function run() {
    if (ranRef.current) return
    ranRef.current = true

    const cache = loadCache()
    const uniqueLocs = Object.keys(locMap)
    const toGeocode = uniqueLocs.filter((loc) => !(loc in cache))

    setPins(buildPins(locMap, cache))
    if (!toGeocode.length) return

    setGeocoding(true)
    setProgress({ done: 0, total: toGeocode.length })

    for (let i = 0; i < toGeocode.length; i++) {
      if (abortRef.current) break
      const loc = toGeocode[i]
      try {
        cache[loc] = (await geocodeLocation(loc)) || null
        saveCache(cache)
      } catch {
        cache[loc] = null
      }
      setProgress({ done: i + 1, total: toGeocode.length })
      setPins(buildPins(locMap, cache))
      if (i < toGeocode.length - 1) await sleep(1100) // Nominatim: 1 req/s
    }

    setGeocoding(false)
  }

  function clearCache() {
    localStorage.removeItem(GEO_CACHE_KEY)
    ranRef.current = false
    run()
  }

  const locatedCount = pins.reduce((s, p) => s + p.properties.length, 0)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 240px)', minHeight: '420px' }}>
      {/* Status bar */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <p className="text-xs text-gray-600">
          {locatedCount} propert{locatedCount !== 1 ? 'ies' : 'y'} mapped
          {unlocatedCount > 0 && (
            <span className="ml-2 text-gray-700">· {unlocatedCount} missing address</span>
          )}
        </p>
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
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden border border-gray-800 min-h-0">
        <MapContainer
          center={[39, -98]}
          zoom={4}
          style={{ height: '100%', width: '100%', background: '#111827' }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            maxZoom={19}
          />

          {pins.map((pin, i) => {
            // Use dominant type for pin color
            const typeCounts = {}
            pin.properties.forEach((p) => {
              const t = p.type || 'other'
              typeCounts[t] = (typeCounts[t] || 0) + 1
            })
            const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0]
            const colors = TYPE_COLORS[dominantType] || TYPE_COLORS.other
            const count = pin.properties.length
            const radius = count >= 5 ? 12 : count >= 2 ? 9 : 7

            return (
              <CircleMarker
                key={i}
                center={[pin.lat, pin.lng]}
                radius={radius}
                pathOptions={{ color: colors.stroke, fillColor: colors.fill, fillOpacity: 0.85, weight: 1.5 }}
              >
                <Popup className="crm-map-popup" maxWidth={260} minWidth={200}>
                  <div style={{ fontFamily: 'inherit' }}>
                    {pin.properties.map((p) => {
                      const c = TYPE_COLORS[p.type] || TYPE_COLORS.other
                      return (
                        <div
                          key={p.id}
                          onClick={() => navigate(`/properties/${p.id}`)}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '10px',
                            padding: '7px 4px', cursor: 'pointer',
                            borderBottom: '1px solid #1f2937',
                          }}
                        >
                          <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: '#1f2937', border: '1px solid #374151',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <Building2 size={14} color={c.fill} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: '13px', color: '#f3f4f6', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.name || p.address || 'Untitled'}
                            </p>
                            <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
                              {[TYPE_LABELS[p.type], fmtCompact(p.value)].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 flex-shrink-0">
        {Object.entries(TYPE_COLORS).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: c.fill }} />
            {TYPE_LABELS[type]}
          </div>
        ))}
        <span className="ml-auto text-xs text-gray-700">Click a pin to view · Scroll to zoom</span>
      </div>
    </div>
  )
}
