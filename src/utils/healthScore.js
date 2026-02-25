import { differenceInDays } from 'date-fns'

export const calculateHealthScore = (contact) => {
  let score = 100
  const lastContact = contact.lastAnyContact?.toDate?.() || null
  if (lastContact) {
    const daysSince = differenceInDays(new Date(), lastContact)
    if (daysSince > 90) score -= 50
    else if (daysSince > 60) score -= 30
    else if (daysSince > 30) score -= 15
    else if (daysSince > 14) score -= 5
  } else {
    score -= 40
  }
  return Math.max(0, score)
}

export const getHealthStatus = (score) => {
  if (score >= 80) return 'active'
  if (score >= 60) return 'warm'
  if (score >= 40) return 'cooling'
  if (score >= 20) return 'cold'
  return 'at_risk'
}

export const healthStatusColor = {
  active: 'bg-green-100 text-green-700',
  warm: 'bg-yellow-100 text-yellow-700',
  cooling: 'bg-orange-100 text-orange-700',
  cold: 'bg-red-100 text-red-700',
  at_risk: 'bg-red-200 text-red-800',
}
