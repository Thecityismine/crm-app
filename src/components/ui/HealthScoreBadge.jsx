import { getHealthScore } from '@/lib/healthScore'

const STYLES = {
  green:  'bg-green-500/15 text-green-400',
  yellow: 'bg-yellow-500/15 text-yellow-400',
  orange: 'bg-orange-500/15 text-orange-400',
  red:    'bg-red-500/15 text-red-400',
  gray:   'bg-gray-800 text-gray-500',
}

export default function HealthScoreBadge({ contact }) {
  const { label, color } = getHealthScore(contact)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STYLES[color]}`}>
      {label}
    </span>
  )
}
