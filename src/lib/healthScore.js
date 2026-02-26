// Compute a relationship health score purely from contact fields.
// No extra network calls — uses lastCommunication, nextFollowUp, and interval.

const INTERVAL_DAYS = {
  '30 Days': 30,
  '60 Days': 60,
  '90 Days': 90,
  '6 Months': 180,
  '1 Year': 365,
}

/**
 * Returns { score, label, color, daysOverdue }
 *   score:   'active' | 'due_soon' | 'overdue' | 'cold' | 'unknown'
 *   label:   human-readable string
 *   color:   tailwind color key used by HealthScoreBadge
 *   daysOverdue: number (negative means days until due, positive means overdue)
 */
export function getHealthScore(contact) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  // --- Primary signal: explicit nextFollowUp date ---
  if (contact.nextFollowUp) {
    const due = new Date(contact.nextFollowUp)
    due.setHours(0, 0, 0, 0)
    const diff = Math.round((due - now) / 86400000) // negative = overdue

    if (diff > 7)  return { score: 'active',   label: 'On Track',  color: 'green',  daysOverdue: diff }
    if (diff >= 0) return { score: 'due_soon', label: 'Due Soon',  color: 'yellow', daysOverdue: diff }
    if (diff >= -14) return { score: 'overdue', label: 'Overdue',  color: 'orange', daysOverdue: diff }
    return               { score: 'cold',     label: 'Cold',      color: 'red',    daysOverdue: diff }
  }

  // --- Secondary: interval + lastCommunication ---
  const intervalDays = INTERVAL_DAYS[contact.interval]
  if (intervalDays && contact.lastCommunication) {
    const last = new Date(contact.lastCommunication)
    const daysSince = Math.round((now - last) / 86400000)
    const daysOverdue = daysSince - intervalDays

    if (daysOverdue < -7)  return { score: 'active',   label: 'On Track',  color: 'green',  daysOverdue }
    if (daysOverdue <= 0)  return { score: 'due_soon', label: 'Due Soon',  color: 'yellow', daysOverdue }
    if (daysOverdue <= 14) return { score: 'overdue',  label: 'Overdue',   color: 'orange', daysOverdue }
    return                        { score: 'cold',     label: 'Cold',      color: 'red',    daysOverdue }
  }

  // --- Tertiary: just lastCommunication, no interval ---
  if (contact.lastCommunication) {
    const last = new Date(contact.lastCommunication)
    const daysSince = Math.round((now - last) / 86400000)

    if (daysSince < 30)  return { score: 'active',   label: 'Active',   color: 'green',  daysOverdue: -daysSince }
    if (daysSince < 60)  return { score: 'due_soon', label: 'Check In', color: 'yellow', daysOverdue: daysSince - 30 }
    if (daysSince < 120) return { score: 'overdue',  label: 'Overdue',  color: 'orange', daysOverdue: daysSince - 30 }
    return                      { score: 'cold',     label: 'Cold',     color: 'red',    daysOverdue: daysSince - 30 }
  }

  return { score: 'unknown', label: 'No Activity', color: 'gray', daysOverdue: 0 }
}

/** Returns contacts that need attention, sorted most urgent first */
export function getNeedsAttention(contacts) {
  return contacts
    .map((c) => ({ ...c, _health: getHealthScore(c) }))
    .filter((c) => ['overdue', 'cold', 'due_soon'].includes(c._health.score))
    .sort((a, b) => b._health.daysOverdue - a._health.daysOverdue)
}
