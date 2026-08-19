import { useState, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { Loader2, RefreshCw, Users, Building2, Heart, Maximize2 } from 'lucide-react'
import { useContactStore } from '@/store/contactStore'
import { useMemoryStore } from '@/store/memoryStore'
import { useGeocodedPins } from '@/hooks/useGeocodedPins'
import { normLoc, buildPins } from '@/lib/geocode'
import { getProperties } from '@/lib/firebase/properties'
import { localDateOnly } from '@/lib/dates'
import { format } from 'date-fns'
import Avatar from '@/components/ui/Avatar'
import 'leaflet/dist/leaflet.css'

const LAYER_COLORS = {
  contacts:   { stroke: '#1d4ed8', fill: '#3b82f6' },
  properties: { stroke: '#b45309', fill: '#fbbf24' },
  memories:   { stroke: '#6d28d9', fill: '#a78bfa' },
}

const LS_LAYERS = 'crm_map_layers'

function loadLayers() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_LAYERS) || 'null')
    if (saved) return saved
  } catch { /* fall through to defaults */ }
  return { contacts: true, properties: false, memories: true }
}

/**
 * Frames the pins once, when the first ones arrive.
 *
 * Deliberately not on every change: the contact and property layers stream
 * their pins in one per second while geocoding, and refitting on each one would
 * yank the map out from under anyone trying to look at it.
 */
function FitBounds({ pins, fitToken }) {
  const map = useMap()
  const fittedRef = useRef(false)

  useEffect(() => {
    if (!pins.length) return
    if (fittedRef.current && fitToken === 0) return
    fittedRef.current = true
    const bounds = pins.map((p) => [p.lat, p.lng])
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
  }, [pins.length, fitToken]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

function LayerChip({ active, onClick, icon: Icon, label, count, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-2 ${
        active
          ? 'bg-gray-800 text-gray-100 border-gray-700'
          : 'bg-gray-900 text-gray-600 border-gray-800 hover:text-gray-400'
      }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ background: active ? color : 'transparent', border: `1px solid ${color}` }}
      />
      <Icon size={13} />
      {label}
      <span className={active ? 'text-gray-500' : 'text-gray-700'}>{count}</span>
    </button>
  )
}

export default function MapView() {
  const { contacts } = useContactStore()
  const { memories } = useMemoryStore()
  const navigate = useNavigate()

  const [layers, setLayers] = useState(loadLayers)
  const [properties, setProperties] = useState([])
  const [fitToken, setFitToken] = useState(0)

  const toggle = (key) =>
    setLayers((l) => {
      const next = { ...l, [key]: !l[key] }
      try { localStorage.setItem(LS_LAYERS, JSON.stringify(next)) } catch { /* best effort */ }
      return next
    })

  // Properties have no store of their own, so this page fetches its own copy —
  // once, and only if the layer is ever switched on.
  const fetchedProps = useRef(false)
  useEffect(() => {
    if (!layers.properties || fetchedProps.current) return
    fetchedProps.current = true
    getProperties()
      .then(setProperties)
      .catch((err) => console.warn('map property fetch failed:', err))
  }, [layers.properties])

  // ── Contacts: coarse city strings, so they normalise and share a cache ──
  const contactLocMap = useMemo(() => {
    if (!layers.contacts) return {}
    const map = {}
    for (const c of contacts) {
      const raw = c.location?.trim() || c.address?.trim() || ''
      if (!raw) continue
      const loc = normLoc(raw)
      if (!map[loc]) map[loc] = []
      map[loc].push(c)
    }
    return map
  }, [contacts, layers.contacts])

  // ── Properties: street addresses, kept raw so distinct buildings stay distinct ──
  const propertyLocMap = useMemo(() => {
    if (!layers.properties) return {}
    const map = {}
    for (const p of properties) {
      const loc = p.address?.trim() || p.location?.trim() || ''
      if (!loc) continue
      if (!map[loc]) map[loc] = []
      map[loc].push(p)
    }
    return map
  }, [properties, layers.properties])

  const contactGeo = useGeocodedPins(contactLocMap, {
    lsKey: 'crm_geo_cache',
    remoteDoc: 'locations',
  })
  const propertyGeo = useGeocodedPins(propertyLocMap, { lsKey: 'crm_property_geo_cache' })

  // ── Memories: coordinates were resolved when the moment was saved, so this
  //    layer paints immediately instead of crawling a geocoder ──
  const memoryPins = useMemo(() => {
    if (!layers.memories) return []
    const locMap = {}
    const cache = {}
    for (const m of memories) {
      if (m.archived) continue
      const lat = m.place?.lat
      const lng = m.place?.lng
      if (lat == null || lng == null) continue
      const key = `${lat},${lng}`
      if (!locMap[key]) {
        locMap[key] = []
        cache[key] = { lat, lng }
      }
      locMap[key].push(m)
    }
    // Same grouping the other two layers use, so co-located records merge
    // identically everywhere.
    return buildPins(locMap, cache)
  }, [memories, layers.memories])

  const unplacedMemories = useMemo(
    () => memories.filter((m) => !m.archived && m.place?.lat == null).length,
    [memories]
  )

  const allPins = useMemo(
    () => [...contactGeo.pins, ...propertyGeo.pins, ...memoryPins],
    [contactGeo.pins, propertyGeo.pins, memoryPins]
  )

  const geocoding = contactGeo.geocoding || propertyGeo.geocoding
  const progress = contactGeo.geocoding ? contactGeo.progress : propertyGeo.progress

  const clearCaches = () => {
    contactGeo.clearCache()
    propertyGeo.clearCache()
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 130px)' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Map</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {allPins.length} {allPins.length === 1 ? 'place' : 'places'}
            {unplacedMemories > 0 && layers.memories && (
              <span className="ml-2 text-gray-700">
                · {unplacedMemories} {unplacedMemories === 1 ? 'moment has' : 'moments have'} no pin
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {geocoding && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={13} className="animate-spin" />
              Geocoding {progress.done}/{progress.total}…
            </div>
          )}
          <button
            onClick={() => setFitToken((t) => t + 1)}
            title="Fit the map to everything shown"
            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-800 transition-colors"
          >
            <Maximize2 size={15} />
          </button>
          <button
            onClick={clearCaches}
            title="Clear geocode caches and re-fetch"
            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-800 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Layers */}
      <div className="flex flex-wrap items-center gap-2 mb-3 flex-shrink-0">
        <LayerChip
          active={layers.contacts} onClick={() => toggle('contacts')}
          icon={Users} label="Contacts"
          count={contactGeo.pins.reduce((s, p) => s + p.items.length, 0)}
          color={LAYER_COLORS.contacts.fill}
        />
        <LayerChip
          active={layers.properties} onClick={() => toggle('properties')}
          icon={Building2} label="Properties"
          count={propertyGeo.pins.reduce((s, p) => s + p.items.length, 0)}
          color={LAYER_COLORS.properties.fill}
        />
        <LayerChip
          active={layers.memories} onClick={() => toggle('memories')}
          icon={Heart} label="Memories"
          count={memoryPins.reduce((s, p) => s + p.items.length, 0)}
          color={LAYER_COLORS.memories.fill}
        />
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
          <FitBounds pins={allPins} fitToken={fitToken} />

          {/* Contacts */}
          {layers.contacts && contactGeo.pins.map((pin, i) => {
            const n = pin.items.length
            return (
              <CircleMarker
                key={`c${i}`}
                center={[pin.lat, pin.lng]}
                radius={n >= 10 ? 14 : n >= 5 ? 11 : n >= 2 ? 8 : 6}
                pathOptions={{ color: LAYER_COLORS.contacts.stroke, fillColor: LAYER_COLORS.contacts.fill, fillOpacity: 0.85, weight: 1.5 }}
              >
                <Popup className="crm-map-popup" maxWidth={240} minWidth={180}>
                  <div style={{ fontFamily: 'inherit' }}>
                    {pin.items.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => navigate(`/contacts/${c.id}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 4px', cursor: 'pointer', borderBottom: '1px solid #1f2937' }}
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

          {/* Properties */}
          {layers.properties && propertyGeo.pins.map((pin, i) => {
            const n = pin.items.length
            return (
              <CircleMarker
                key={`p${i}`}
                center={[pin.lat, pin.lng]}
                radius={n >= 5 ? 12 : n >= 2 ? 9 : 7}
                pathOptions={{ color: LAYER_COLORS.properties.stroke, fillColor: LAYER_COLORS.properties.fill, fillOpacity: 0.85, weight: 1.5 }}
              >
                <Popup className="crm-map-popup" maxWidth={260} minWidth={200}>
                  <div style={{ fontFamily: 'inherit' }}>
                    {pin.items.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => navigate(`/properties/${p.id}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 4px', cursor: 'pointer', borderBottom: '1px solid #1f2937' }}
                      >
                        <Building2 size={16} color={LAYER_COLORS.properties.fill} style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: '13px', color: '#f3f4f6', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.name || p.address || 'Untitled'}
                          </p>
                          {p.address && (
                            <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.address}
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

          {/* Memories */}
          {layers.memories && memoryPins.map((pin, i) => {
            const n = pin.items.length
            return (
              <CircleMarker
                key={`m${i}`}
                center={[pin.lat, pin.lng]}
                radius={n >= 5 ? 12 : n >= 2 ? 9 : 7}
                pathOptions={{ color: LAYER_COLORS.memories.stroke, fillColor: LAYER_COLORS.memories.fill, fillOpacity: 0.85, weight: 1.5 }}
              >
                <Popup className="crm-map-popup" maxWidth={260} minWidth={200}>
                  <div style={{ fontFamily: 'inherit' }}>
                    {pin.items.map((m) => {
                      const day = localDateOnly(m.date)
                      return (
                        <div
                          key={m.id}
                          onClick={() => navigate(`/memories/${m.id}`)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 4px', cursor: 'pointer', borderBottom: '1px solid #1f2937' }}
                        >
                          {m.photoUrls?.[0] ? (
                            <img
                              src={m.photoUrls[0]}
                              alt=""
                              style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                            />
                          ) : (
                            <Heart size={16} color={LAYER_COLORS.memories.fill} style={{ flexShrink: 0 }} />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: '13px', color: '#f3f4f6', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {m.title || 'Untitled moment'}
                            </p>
                            <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {[day && format(day, 'MMM d, yyyy'), m.place?.label].filter(Boolean).join(' · ')}
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

      <p className="text-xs text-gray-700 mt-2 flex-shrink-0 text-right">
        Click a pin · Scroll to zoom
      </p>
    </div>
  )
}
