// Guards the bug this module exists to prevent: deriving a calendar day, or a
// datetime-local field value, from toISOString() — which is UTC, not local.
//
// Written to hold in any timezone. The reference moment is built from local
// components rather than a fixed offset, and the old behaviour is asserted as
// drift equal to the zone's offset rather than as hardcoded strings.
//
//   node src/lib/dates.test.mjs
//   TZ=Asia/Tokyo node src/lib/dates.test.mjs
import { toDateKey, toDateTimeValue, localDateOnly, daysFromToday } from './dates.js'

let failures = 0
const check = (name, got, want) => {
  const ok = got === want
  if (!ok) failures++
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + '  ->  ' + got + (ok ? '' : '   expected ' + want))
}

// 7:46pm on 19 August, local — the moment from the bug report.
const evening = new Date(2026, 7, 19, 19, 46)
const offsetMin = evening.getTimezoneOffset() // minutes behind UTC; EDT = 240

console.log('TZ =', Intl.DateTimeFormat().resolvedOptions().timeZone,
  '| offset', offsetMin, 'min | UTC sees', evening.toISOString().slice(0, 10))

check('toDateKey keeps the local day', toDateKey(evening), '2026-08-19')
check('toDateTimeValue keeps the local clock time', toDateTimeValue(evening), '2026-08-19T19:46')

// The defect was a double conversion. The field was seeded with UTC clock time,
// a datetime-local input read that as local, and saving converted local -> UTC
// again — so the offset landed twice.
const oldSeed = evening.toISOString().slice(0, 16)
const oldStored = new Date(oldSeed)
const newStored = new Date(toDateTimeValue(evening))

if (offsetMin === 0) {
  console.log('SKIP  old-behaviour drift checks (no offset to drift by in UTC)')
} else {
  check('old: saved instant drifted by exactly the offset',
    Math.round((oldStored - evening) / 60000), offsetMin)
  // West of UTC the drift is forward, which is what rendered "-1 days ago".
  if (offsetMin > 0) {
    check('old: rendered as a negative day count',
      Math.floor((evening - oldStored) / 86400000), -1)
  }
}

check('new: instant survives seed and save unchanged', newStored.getTime(), evening.getTime())
check('new: records the day it actually happened', toDateKey(newStored), '2026-08-19')
check('new: renders as today, not yesterday or tomorrow',
  Math.floor((evening - newStored) / 86400000), 0)

// Ordinary calendar-date handling still holds.
check('just past midnight is the new day', toDateKey(new Date(2026, 7, 20, 0, 15)), '2026-08-20')
check('a stored day reads back as itself', localDateOnly('2026-08-19').getDate(), 19)
check('today is zero days from today', daysFromToday(toDateKey(new Date())), 0)
check('invalid input yields null', toDateKey('nonsense'), null)

console.log(failures === 0 ? '\nall passed' : '\n' + failures + ' FAILED')
process.exit(failures ? 1 : 0)
