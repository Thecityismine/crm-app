import { useNavigate } from 'react-router-dom'
import { MapPin, Building2, Layers } from 'lucide-react'

const TYPE_STYLES = {
  office:       { label: 'Office',       bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20' },
  retail:       { label: 'Retail',       bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20' },
  industrial:   { label: 'Industrial',   bg: 'bg-orange-500/10',  text: 'text-orange-400',  border: 'border-orange-500/20' },
  multifamily:  { label: 'Multifamily',  bg: 'bg-violet-500/10',  text: 'text-violet-400',  border: 'border-violet-500/20' },
  land:         { label: 'Land',         bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  mixed_use:    { label: 'Mixed Use',    bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    border: 'border-cyan-500/20' },
  other:        { label: 'Other',        bg: 'bg-gray-500/10',    text: 'text-gray-400',    border: 'border-gray-500/20' },
}

const fmt = (n) =>
  n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n) : null

export default function PropertyCard({ property, leaseCount = 0 }) {
  const navigate = useNavigate()
  const style = TYPE_STYLES[property.type] || TYPE_STYLES.other

  return (
    <div
      className="card p-4 cursor-pointer hover:border-gray-600 transition-colors"
      onClick={() => navigate(`/properties/${property.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
          <Building2 size={18} className={style.text} />
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${style.bg} ${style.text} ${style.border}`}>
          {style.label}
        </span>
      </div>

      {/* Name / Address */}
      <h3 className="text-sm font-semibold text-gray-100 truncate leading-snug">
        {property.name || property.address || 'Untitled Property'}
      </h3>
      {property.name && property.address && (
        <p className="flex items-center gap-1 text-xs text-gray-500 mt-1 truncate">
          <MapPin size={11} className="flex-shrink-0" />
          {property.address}
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-800">
        {property.size && (
          <span className="text-xs text-gray-500">
            <span className="text-gray-300 font-medium">
              {Number(property.size).toLocaleString()}
            </span>{' '}SF
          </span>
        )}
        {property.value && (
          <span className="text-xs text-gray-500">
            <span className="text-emerald-400 font-medium">{fmt(property.value)}</span>
          </span>
        )}
        {leaseCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-gray-600">
            <Layers size={11} />
            {leaseCount} lease{leaseCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}
