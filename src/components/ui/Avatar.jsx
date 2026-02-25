const COLORS = [
  'bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-red-600',
  'bg-orange-600', 'bg-pink-600', 'bg-indigo-600', 'bg-teal-600',
]

const getColor = (name) => COLORS[(name?.charCodeAt(0) || 0) % COLORS.length]

export default function Avatar({ firstName, lastName, size = 'md' }) {
  const sizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  }
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?'
  return (
    <div className={`${sizes[size]} ${getColor(firstName)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  )
}
