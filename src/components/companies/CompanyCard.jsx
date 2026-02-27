import { useNavigate } from 'react-router-dom'
import { Globe, MapPin, Phone, Users, Briefcase } from 'lucide-react'

const COLORS = [
  'bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-purple-600',
  'bg-pink-600', 'bg-rose-600', 'bg-orange-600', 'bg-amber-600',
  'bg-teal-600', 'bg-cyan-600', 'bg-emerald-600', 'bg-green-600',
]

function companyColor(name) {
  if (!name) return COLORS[0]
  // Sum all char codes for a more distributed hash than just first char
  const hash = [...name].reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return COLORS[hash % COLORS.length]
}

export function CompanyAvatar({ name, size = 'md' }) {
  const initials = name
    ? name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?'
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  return (
    <div className={`${sz} rounded-lg ${companyColor(name)} flex items-center justify-center flex-shrink-0`}>
      <span className="font-bold text-white">{initials}</span>
    </div>
  )
}

// ── Grid card ──────────────────────────────────────────────────────────────
export default function CompanyCard({ company, contactCount = 0, dealCount = 0, onClick }) {
  const navigate = useNavigate()

  return (
    <div
      className="card p-4 cursor-pointer hover:border-gray-700 hover:bg-gray-800/50 transition-all"
      onClick={onClick ?? (() => navigate(`/companies/${company.id}`))}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <CompanyAvatar name={company.name} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-100 truncate leading-tight">{company.name}</p>
          {company.industry && (
            <span className="inline-block mt-1 text-xs bg-gray-800 border border-gray-700/60 text-gray-400 px-2 py-0.5 rounded-full">
              {company.industry}
            </span>
          )}
        </div>
      </div>

      {/* Detail rows */}
      <div className="space-y-1 mb-3">
        {company.location && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <MapPin size={11} className="flex-shrink-0 text-gray-600" />
            <span className="truncate">{company.location}</span>
          </div>
        )}
        {company.website && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Globe size={11} className="flex-shrink-0 text-gray-600" />
            <span className="truncate">{company.website.replace(/^https?:\/\//, '')}</span>
          </div>
        )}
        {company.phone && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Phone size={11} className="flex-shrink-0 text-gray-600" />
            {company.phone}
          </div>
        )}
      </div>

      {/* Footer badges */}
      {(contactCount > 0 || dealCount > 0) && (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-800/60">
          {contactCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Users size={11} className="text-gray-600" />
              {contactCount} contact{contactCount !== 1 ? 's' : ''}
            </div>
          )}
          {dealCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-blue-400 ml-auto">
              <Briefcase size={11} />
              {dealCount} deal{dealCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── List row ───────────────────────────────────────────────────────────────
export function CompanyListRow({ company, contactCount = 0, dealCount = 0, onClick }) {
  const navigate = useNavigate()

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60 last:border-0 cursor-pointer hover:bg-gray-800/40 transition-colors"
      onClick={onClick ?? (() => navigate(`/companies/${company.id}`))}
    >
      <CompanyAvatar name={company.name} size="sm" />

      {/* Name + industry */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-200 truncate">{company.name}</p>
        {company.industry && (
          <p className="text-xs text-gray-500 truncate">{company.industry}</p>
        )}
      </div>

      {/* Location */}
      <div className="hidden md:block w-36 min-w-0">
        <p className="text-xs text-gray-500 truncate">{company.location || '—'}</p>
      </div>

      {/* Website */}
      <div className="hidden lg:block w-36 min-w-0">
        <p className="text-xs text-gray-500 truncate">
          {company.website ? company.website.replace(/^https?:\/\//, '') : '—'}
        </p>
      </div>

      {/* Contacts */}
      <div className="flex items-center gap-1 text-xs text-gray-500 w-20 justify-end flex-shrink-0">
        {contactCount > 0 && (
          <>
            <Users size={11} className="text-gray-600" />
            {contactCount}
          </>
        )}
      </div>

      {/* Deals */}
      <div className="flex items-center gap-1 text-xs w-16 justify-end flex-shrink-0">
        {dealCount > 0 ? (
          <span className="flex items-center gap-1 text-blue-400">
            <Briefcase size={11} />
            {dealCount}
          </span>
        ) : (
          <span className="text-gray-700">—</span>
        )}
      </div>
    </div>
  )
}
