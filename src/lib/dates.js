// Calendar-date math for date-only fields.
//
// This app stores date-only values two ways: bare 'YYYY-MM-DD' (birthdate,
// dueDate, closingDate) and UTC-midnight ISO strings (nextFollowUp). Both are
// calendar dates, not instants — "due Aug 20" means the whole of Aug 20 in the
// user's timezone, not a moment.
//
// Every bug this file exists to prevent came from mixing the two. The pattern
// that keeps reappearing is anchoring a date at local noon and then measuring
// against `new Date()` or local midnight:
//
//   Math.round((noon_today - midnight_today) / 86400000)  →  Math.round(0.5)  →  1
//
// which reports today as tomorrow. That shipped three separate times — in the
// notifications hook, the dashboard widget, and the task list — because there
// was no shared helper to reach for. Reach for these.

/** Local midnight for today. */
export function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Local midnight for a stored date, read from its calendar date only.
 *
 * Slicing to the date portion discards any time and zone, so a UTC-midnight
 * timestamp doesn't slip to the previous evening in a negative offset. The noon
 * anchor keeps the parse clear of DST edges; snapping to midnight afterwards is
 * what makes the arithmetic below exact.
 */
export function localDateOnly(value) {
  if (!value) return null
  const d = new Date(String(value).slice(0, 10) + 'T12:00:00')
  if (isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Whole days from today to a stored date. Negative is the past.
 * Returns null when there's no usable date.
 *
 * Both operands are local midnight, so the result is an exact integer and does
 * not drift with the time of day the user happens to look at the screen.
 */
export function daysFromToday(value, from = startOfToday()) {
  const d = localDateOnly(value)
  if (!d) return null
  return Math.round((d - from) / 86400000)
}

/** True when the stored date is strictly before today. */
export function isPastDate(value, from = startOfToday()) {
  const diff = daysFromToday(value, from)
  return diff !== null && diff < 0
}
