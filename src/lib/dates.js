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

const pad = (n) => String(n).padStart(2, '0')

/**
 * The calendar day a moment fell on, locally, as 'YYYY-MM-DD'.
 *
 * Not toISOString().slice(0, 10) — that is the UTC day. West of UTC an evening
 * is already tomorrow there, so a 7pm call got recorded as happening the next
 * day, and every "days since" built on it was off by one.
 */
export function toDateKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Value for a `datetime-local` input, in local time.
 *
 * A datetime-local input reads whatever it is given as local time, so seeding
 * it from toISOString() showed the wrong clock time — and saving that back
 * shifted the stored instant by the offset, a full day for evening entries.
 */
export function toDateTimeValue(d = new Date()) {
  const date = toDateKey(d)
  return date && `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
