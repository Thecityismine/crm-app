// Repeating tasks: what the options are, and where the next one falls.
//
// A recurring task is not a single row that keeps moving. Completing one writes
// the finished instance to history and opens the next — so the Done tab still
// answers "did I do last month's inspection?" instead of only ever holding the
// one open copy.
//
// The date maths lives here rather than inline at the call site because the
// two ways to get it wrong are easy to reach for and both silently drift:
//
//   * Repeatedly adding a month to the *previous* result. Jan 31 clamps to
//     Feb 28, and every month after that is stuck on the 28th. Each next date
//     is computed from the original due date and a step count instead, so a
//     31st that clamps in February is back on the 31st in March.
//   * new Date(y, m + 1, 31) for a 30-day month, which rolls into the next
//     month — a monthly task due the 31st would skip a month entirely.

import { localDateOnly, toDateKey, startOfToday } from './dates.js'

export const RECURRENCE_OPTIONS = [
  { value: 'none',    label: 'Does not repeat' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly' },
]

export const RECURRENCE_LABELS = {
  weekly:  'Weekly',
  monthly: 'Monthly',
  yearly:  'Yearly',
}

/** True when a task is set to repeat. Anything but a known interval is not. */
export function isRecurring(task) {
  return !!task && !!RECURRENCE_LABELS[task.recurrence]
}

/** A local date for `day` of the given month, pulled back to the month's last
 *  day when it is short. `monthIndex` may fall outside 0–11; it is normalised. */
function clampDay(year, monthIndex, day) {
  const y = year + Math.floor(monthIndex / 12)
  const m = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(y, m + 1, 0).getDate()   // day 0 of next month
  return new Date(y, m, Math.min(day, lastDay))
}

/** The date `steps` intervals on from `base`, always measured from `base`. */
function advance(base, recurrence, steps) {
  const y = base.getFullYear(), m = base.getMonth(), d = base.getDate()
  switch (recurrence) {
    case 'weekly':  return new Date(y, m, d + 7 * steps)
    case 'monthly': return clampDay(y, m + steps, d)
    case 'yearly':  return clampDay(y + steps, m, d)
    default:        return null
  }
}

/**
 * The next due date after completing a recurring task, as 'YYYY-MM-DD'.
 *
 * Walks forward until it lands past `from` (today by default), so finishing a
 * task that has been overdue for six weeks schedules the next one ahead of you
 * rather than in the past — where it would show up already overdue and, on the
 * next tick, spawn another one behind you again.
 *
 * Returns null when the interval is not a repeating one.
 */
export function nextDueDate(dueDate, recurrence, from = startOfToday()) {
  if (!RECURRENCE_LABELS[recurrence]) return null
  // No due date to count from — a repeating task still has to land somewhere,
  // so measure the first interval from today.
  const base = localDateOnly(dueDate) || from
  for (let steps = 1; steps <= 5000; steps++) {
    const next = advance(base, recurrence, steps)
    if (next > from) return toDateKey(next)
  }
  return null
}
