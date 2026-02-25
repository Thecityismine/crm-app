import { useState } from 'react'

const COLORS = [
  'bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-red-600',
  'bg-orange-600', 'bg-pink-600', 'bg-indigo-600', 'bg-teal-600',
]

const getColor = (name) => COLORS[(name?.charCodeAt(0) || 0) % COLORS.length]

// Extract LinkedIn username from stored URL and build unavatar.io proxy URL
// Handles: "linkedin.com/in/username", "https://www.linkedin.com/in/username/"
export const getLinkedInPhotoUrl = (linkedinUrl) => {
  if (!linkedinUrl) return null
  const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?#\s]+)/i)
  if (!match) return null
  return `https://unavatar.io/linkedin/${match[1]}`
}

export default function Avatar({ firstName, lastName, size = 'md', src }) {
  const [imgError, setImgError] = useState(false)

  const sizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  }

  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?'

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={`${firstName} ${lastName}`}
        className={`${sizes[size]} rounded-full object-cover flex-shrink-0 bg-gray-800`}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div className={`${sizes[size]} ${getColor(firstName)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  )
}
