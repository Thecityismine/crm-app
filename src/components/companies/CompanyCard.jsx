import { useNavigate } from 'react-router-dom'
import { Globe, MapPin, Phone, Users } from 'lucide-react'

function CompanyAvatar({ name }) {
  const initials = name
    ? name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?'

  // Deterministic color from name
  const colors = [
    'bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-purple-600',
    'bg-pink-600', 'bg-rose-600', 'bg-orange-600', 'bg-amber-600',
    'bg-teal-600', 'bg-cyan-600', 'bg-emerald-600', 'bg-green-600',
  ]
  const idx = name ? name.charCodeAt(0) % colors.length : 0

  return (
    <div className={`w-10 h-10 rounded-lg ${colors[idx]} flex items-center justify-center flex-shrink-0`}>
      <span className="text-sm font-bold text-white">{initials}</span>
    </div>
  )
}

export default function CompanyCard({ company, contactCount = 0, onClick }) {
  const navigate = useNavigate()

  return (
    <div
      className="card p-4 cursor-pointer hover:border-gray-700 hover:bg-gray-800/50 transition-all"
      onClick={onClick ?? (() => navigate(`/companies/${company.id}`))}
    >
      <div className="flex items-start gap-3 mb-3">
        <CompanyAvatar name={company.name} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-100 truncate">{company.name}</p>
          {company.industry && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{company.industry}</p>
          )}
        </div>
        {contactCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
            <Users size={11} />
            {contactCount}
          </div>
        )}
      </div>

      <div className="space-y-1">
        {company.location && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <MapPin size={11} className="flex-shrink-0 text-gray-600" />
            <span className="truncate">{company.location}</span>
          </div>
        )}
        {company.phone && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Phone size={11} className="flex-shrink-0 text-gray-600" />
            {company.phone}
          </div>
        )}
        {company.website && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Globe size={11} className="flex-shrink-0 text-gray-600" />
            <span className="truncate">
              {company.website.replace(/^https?:\/\//, '')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
