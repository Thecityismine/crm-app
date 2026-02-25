const VARIANTS = {
  lead: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  consultant: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  prospect: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  'former client': 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  active: 'bg-green-500/15 text-green-400 border-green-500/20',
  working: 'bg-green-500/15 text-green-400 border-green-500/20',
  connected: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  broker: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  investor: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  tenant: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  lender: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
}

export default function Badge({ label }) {
  if (!label) return null
  const cls = VARIANTS[label.toLowerCase()] || 'bg-gray-500/15 text-gray-400 border-gray-500/20'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls} whitespace-nowrap`}>
      {label}
    </span>
  )
}
