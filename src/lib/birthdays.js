// Single source of truth for birthday date math.
//
// Two separate copies of this drifted into the codebase (the notifications
// hook and the Dashboard widget) and both carried the same off-by-one:
// a birthday falling today reported as "Tomorrow".

/** Local midnight for today. */
export function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Resolve a contact's next birthday.
 * Returns { date, daysUntil } or null when there's no usable date.
 *
 * Birthdays are stored as 'YYYY-MM-DD'. Parsing that bare would land on UTC
 * midnight and slip a day in negative offsets, so we anchor at local noon.
 * The anchor then has to be snapped back to local midnight before measuring:
 * comparing noon against a midnight `from` leaves a birthday today sitting
 * 12 hours out, and Math.round(0.5) is 1 — which is exactly how "today"
 * came to display as "Tomorrow".
 */
export function nextBirthday(contact, from = startOfToday()) {
  const source = contact?.nextBirthday || contact?.birthdate
  if (!source) return null

  const parsed = new Date(source + 'T12:00:00')
  if (isNaN(parsed.getTime())) return null

  const date = new Date(parsed)
  date.setHours(0, 0, 0, 0)

  // A stored `nextBirthday` is already an absolute future date; a `birthdate`
  // carries its original year and has to be rolled forward.
  if (!contact.nextBirthday) {
    date.setFullYear(from.getFullYear())
    if (date < from) date.setFullYear(from.getFullYear() + 1)
  }

  return { date, daysUntil: Math.round((date - from) / 86400000) }
}

/** "Today!" / "Tomorrow" / "In N days" for a day count. */
export function birthdayLabel(daysUntil) {
  if (daysUntil === 0) return 'Today!'
  if (daysUntil === 1) return 'Tomorrow'
  return `In ${daysUntil} days`
}
