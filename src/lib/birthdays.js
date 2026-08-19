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
 * Local midnight for a stored date, read from its calendar date only.
 *
 * Date-only fields get persisted two different ways: `birthdate` as a bare
 * 'YYYY-MM-DD', `nextFollowUp` as `new Date('YYYY-MM-DD').toISOString()` —
 * which is UTC midnight. Feeding that ISO string straight to `new Date()` in a
 * negative offset lands on the previous evening, so a follow-up set for the
 * 20th renders as the 19th and reads as overdue a day early. Slicing to the
 * date portion and anchoring at local noon keeps the calendar date intact.
 */
export function localDateOnly(value) {
  if (!value) return null
  const d = new Date(String(value).slice(0, 10) + 'T12:00:00')
  if (isNaN(d.getTime())) return null
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
