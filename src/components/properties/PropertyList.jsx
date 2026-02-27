import { useNavigate } from 'react-router-dom'
import { MapPin, Building2 } from 'lucide-react'

const TYPE_STYLES = {
  office:      { label: 'Office',      text: 'text-blue-400' },
  retail:      { label: 'Retail',      text: 'text-amber-400' },
  industrial:  { label: 'Industrial',  text: 'text-orange-400' },
  multifamily: { label: 'Multifamily', text: 'text-violet-400' },
  land:        { label: 'Land',        text: 'text-emerald-400' },
  mixed_use:   { label: 'Mixed Use',   text: 'text-cyan-400' },
  other:       { label: 'Other',       text: 'text-gray-400' },
}

const fmt = (n) =>
  n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n) : null

function PropertyListRow({ property, onEdit }) {
  const navigate = useNavigate()
  const style = TYPE_STYLES[property.type] || TYPE_STYLES.other

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60 last:border-0 cursor-pointer hover:bg-gray-800/40 transition-colors group"
      onClick={() => navigate(`/properties/${property.id}`)}
    >
      {/* Icon */}
      <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700/60 flex items-center justify-center flex-shrink-0">
        <Building2 size={14} className={style.text} />
      </div>

      {/* Name + Address */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-200 truncate">
          {property.name || property.address || 'Untitled Property'}
        </p>
        {property.address && property.name && (
          <p className="text-xs text-gray-600 truncate flex items-center gap-1 mt-0.5">
            <MapPin size={10} className="flex-shrink-0" />
            {property.address}
          </p>
        )}
      </div>

      {/* Type */}
      <div className="hidden sm:block w-28 flex-shrink-0">
        <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
      </div>

      {/* Location */}
      <div className="hidden md:block w-32 min-w-0 flex-shrink-0">
        <p className="text-xs text-gray-500 truncate">{property.location || '—'}</p>
      </div>

      {/* Size */}
      <div className="hidden lg:block w-28 text-right flex-shrink-0">
        <p className="text-xs text-gray-400">
          {property.size ? `${Number(property.size).toLocaleString()} SF` : '—'}
        </p>
      </div>

      {/* Value */}
      <div className="w-28 text-right flex-shrink-0">
        <p className="text-xs text-emerald-400 font-medium">{fmt(property.value) || '—'}</p>
      </div>

      {/* Edit */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(property) }}
        className="opacity-0 group-hover:opacity-100 text-xs text-gray-600 hover:text-gray-300 bg-gray-800 border border-gray-700 px-2 py-1 rounded-lg transition-all flex-shrink-0 ml-1"
      >
        Edit
      </button>
    </div>
  )
}

export default function PropertyList({ properties, onEdit }) {
  return (
    <div className="card overflow-hidden">
      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-800/30">
        <div className="w-8 flex-shrink-0" />
        <div className="flex-1 text-xs text-gray-600 font-medium">Property</div>
        <div className="hidden sm:block w-28 flex-shrink-0 text-xs text-gray-600 font-medium">Type</div>
        <div className="hidden md:block w-32 flex-shrink-0 text-xs text-gray-600 font-medium">Location</div>
        <div className="hidden lg:block w-28 text-right flex-shrink-0 text-xs text-gray-600 font-medium">Size</div>
        <div className="w-28 text-right flex-shrink-0 text-xs text-gray-600 font-medium">Value</div>
        <div className="w-12 flex-shrink-0" />
      </div>
      {properties.map((p) => (
        <PropertyListRow key={p.id} property={p} onEdit={onEdit} />
      ))}
    </div>
  )
}
