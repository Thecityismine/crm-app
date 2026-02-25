import { format, formatDistanceToNow } from 'date-fns'

export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0)

export const formatDate = (ts) => {
  if (!ts) return '—'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return format(date, 'MMM d, yyyy')
}

export const formatRelative = (ts) => {
  if (!ts) return '—'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return formatDistanceToNow(date, { addSuffix: true })
}

export const formatSqft = (sqft) =>
  sqft ? `${sqft.toLocaleString()} SF` : '—'

export const getInitials = (firstName, lastName) =>
  `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
