// The date maths behind repeating tasks. Every case here is a way a monthly or
// yearly interval quietly drifts if the next date is derived from the previous
// one instead of from the original due date.
//
//   node src/lib/recurrence.test.mjs

import { nextDueDate, isRecurring } from './recurrence.js'

let failures = 0
const check = (name, got, want) => {
  const ok = got === want
  if (!ok) failures++
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name +
    (ok ? '' : `\n        got ${got}\n        want ${want}`))
}

// A fixed "today" so the suite does not change answer tomorrow.
const on = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }

// ── The plain cases ──────────────────────────────────────────────────────────
check('weekly steps a week on',   nextDueDate('2026-03-10', 'weekly',  on('2026-03-10')), '2026-03-17')
check('monthly steps a month on', nextDueDate('2026-03-10', 'monthly', on('2026-03-10')), '2026-04-10')
check('yearly steps a year on',   nextDueDate('2026-03-10', 'yearly',  on('2026-03-10')), '2027-03-10')
check('no interval, no date',     nextDueDate('2026-03-10', 'none',    on('2026-03-10')), null)

// ── Short months ─────────────────────────────────────────────────────────────
// Jan 31 has no counterpart in February. Clamping is right; staying clamped is
// not — that is the drift this module is built to avoid.
check('31st clamps into February', nextDueDate('2026-01-31', 'monthly', on('2026-01-31')), '2026-02-28')
check('and is back on the 31st in March',
  nextDueDate('2026-01-31', 'monthly', on('2026-02-28')), '2026-03-31')
check('a 30-day month does not roll into the next one',
  nextDueDate('2026-03-31', 'monthly', on('2026-03-31')), '2026-04-30')
check('Feb 29 falls back to the 28th in a common year',
  nextDueDate('2028-02-29', 'yearly', on('2028-02-29')), '2029-02-28')

// ── Catching up ──────────────────────────────────────────────────────────────
// Finishing something six weeks late must schedule the next one ahead of today,
// not behind it — a date in the past would come back already overdue.
check('overdue weekly lands in the future',
  nextDueDate('2026-01-01', 'weekly', on('2026-02-12')), '2026-02-19')
check('overdue monthly lands on the first date still ahead',
  nextDueDate('2025-11-15', 'monthly', on('2026-03-10')), '2026-03-15')
check('and skips the day it is caught up on',
  nextDueDate('2025-11-15', 'monthly', on('2026-03-15')), '2026-04-15')
check('with no due date at all, count from today',
  nextDueDate(null, 'weekly', on('2026-03-10')), '2026-03-17')

// ── isRecurring ──────────────────────────────────────────────────────────────
check('a task with an interval repeats',      isRecurring({ recurrence: 'monthly' }), true)
check('"none" does not',                      isRecurring({ recurrence: 'none' }),    false)
check('a task with no field does not',        isRecurring({}),                        false)
check('an unknown interval does not',         isRecurring({ recurrence: 'hourly' }),  false)

console.log(failures ? `\n${failures} failing` : '\nall passing')
process.exit(failures ? 1 : 0)
