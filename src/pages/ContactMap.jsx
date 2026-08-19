import { useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { useContactStore } from '@/store/contactStore'
import { useGeocodedPins } from '@/hooks/useGeocodedPins'
import { normLoc } from '@/lib/geocode'
import { Loader2, RefreshCw } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import 'leaflet/dist/leaflet.css'

export default function ContactMap() {
  const { contacts } = useContactStore()
  const navigate = useNavigate()

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

  // Shared across devices: contacts are the largest set of locations here, so
  // the crawl is the one most worth not repeating on a second browser.
  const { pins, geocoding, progress, clearCache } = useGeocodedPins(locMap, {
    lsKey: 'crm_geo_cache',
    remoteDoc: 'locations',
  })

  const locatedCount = pins.reduce((s, p) => s + p.items.length, 0)

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
            const count = pin.items.length
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
                    {pin.items.map((c) => (
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
