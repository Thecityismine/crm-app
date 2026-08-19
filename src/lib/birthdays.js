import { startOfToday } from './dates.js'

// Birthday and anniversary date math. Generic helpers live in ./dates.
//
// Two separate copies of this drifted into the codebase (the notifications
// hook and the Dashboard widget) and both carried the same off-by-one:
// a birthday falling today reported as "Tomorrow".

// The generic calendar-date helpers live in dates.js now — three copies of the
// same off-by-one bug is what it took to earn them a shared home. Re-exported
// here so existing importers keep working.
export { startOfToday, localDateOnly } from './dates.js'

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
  // `birthdate` is the canonical field and carries the original year, so it
  // wins. `nextBirthday` only exists on Notion-imported contacts, where it was
  // an absolute date that was accurate on import day and has been rotting ever
  // since — it's a fallback for month/day, never a date to trust as-is.
  const source = contact?.birthdate || contact?.nextBirthday
  if (!source) return null

  const parsed = new Date(source.slice(0, 10) + 'T12:00:00')
  if (isNaN(parsed.getTime())) return null

  const date = new Date(parsed)
  date.setHours(0, 0, 0, 0)

  // Always roll forward to the next occurrence. Trusting a stored
  // `nextBirthday` verbatim meant every imported contact whose birthday had
  // already passed returned a negative daysUntil and silently dropped out of
  // the dashboard widget, permanently.
  date.setFullYear(from.getFullYear())
  if (date < from) date.setFullYear(from.getFullYear() + 1)

  return { date, daysUntil: Math.round((date - from) / 86400000), age: date.getFullYear() - parsed.getFullYear() }
}

/** "Today!" / "Tomorrow" / "In N days" for a day count. */
export function birthdayLabel(daysUntil) {
  if (daysUntil === 0) return 'Today!'
  if (daysUntil === 1) return 'Tomorrow'
  return `In ${daysUntil} days`
}
