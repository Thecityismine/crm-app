import { useState, useEffect } from 'react'

const COLORS = [
  'bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-red-600',
  'bg-orange-600', 'bg-pink-600', 'bg-indigo-600', 'bg-teal-600',
]

const getColor = (name) => COLORS[(name?.charCodeAt(0) || 0) % COLORS.length]

// In-memory cache so we don't re-fetch the same LinkedIn URL during a session
const _photoCache = {}

// Fetches the LinkedIn profile photo URL via the server-side proxy.
// Returns a Promise<string|null>.
export const fetchLinkedInPhotoUrl = async (linkedinUrl) => {
  if (!linkedinUrl) return null
  if (!/linkedin\.com\/in\//i.test(linkedinUrl)) return null

  if (_photoCache[linkedinUrl] !== undefined) return _photoCache[linkedinUrl]

  try {
    const res = await fetch(`/api/linkedin-photo?url=${encodeURIComponent(linkedinUrl)}`)
    if (!res.ok) {
      _photoCache[linkedinUrl] = null
      return null
    }
    const data = await res.json()
    _photoCache[linkedinUrl] = data.url || null
    return _photoCache[linkedinUrl]
  } catch {
    _photoCache[linkedinUrl] = null
    return null
  }
}

export default function Avatar({ firstName, lastName, size = 'md', src, linkedin }) {
  const [imgError, setImgError] = useState(false)
  const [linkedinPhoto, setLinkedinPhoto] = useState(null)

  useEffect(() => {
    if (src || !linkedin) return
    fetchLinkedInPhotoUrl(linkedin).then((url) => {
      if (url) setLinkedinPhoto(url)
    })
  }, [src, linkedin])

  const sizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  }

  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?'
  const photoSrc = src || linkedinPhoto

  if (photoSrc && !imgError) {
    return (
      <img
        src={photoSrc}
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
