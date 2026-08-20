// Guards the auth gate on the digest endpoint.
//
// The defect this exists to prevent: the check used to read
// `if (secret && provided !== expected)`, so removing or renaming CRON_SECRET
// silently made the endpoint public — and it sends Telegram messages and reads
// the whole contact book.
//
//   node api/daily-digest.test.mjs
import { authorized, todayInZone, weekdayInZone } from './daily-digest.js'

let failures = 0
const check = (name, got, want) => {
  const ok = got === want
  if (!ok) failures++
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + '  ->  ' + got + (ok ? '' : '   expected ' + want))
}

const req = (authHeader) => ({ headers: authHeader === undefined ? {} : { authorization: authHeader } })
const SECRET = 's3cr3t-value'

check('correct bearer token', authorized(req(`Bearer ${SECRET}`), SECRET), true)
check('wrong token', authorized(req('Bearer nope'), SECRET), false)
check('right token, wrong scheme', authorized(req(SECRET), SECRET), false)
check('no header at all', authorized(req(), SECRET), false)
check('empty header', authorized(req(''), SECRET), false)

// The fail-open regression: no configured secret must refuse everyone,
// including a caller who sends nothing and a caller who guesses.
check('unset secret refuses empty header', authorized(req(), undefined), false)
check('unset secret refuses any header', authorized(req('Bearer anything'), undefined), false)
check('unset secret refuses "Bearer undefined"', authorized(req('Bearer undefined'), undefined), false)
check('empty-string secret refuses', authorized(req('Bearer '), ''), false)

// Length mismatch must not throw — timingSafeEqual does on unequal buffers.
check('shorter token does not throw', authorized(req('Bearer s'), SECRET), false)
check('longer token does not throw', authorized(req(`Bearer ${SECRET}xxxxx`), SECRET), false)

// A malformed request object must not crash the handler before it can respond.
check('missing headers object', authorized({}, SECRET), false)
check('null request', authorized(null, SECRET), false)

// The clock helpers the digest scopes its day by.
const nineAmEastern = new Date('2026-08-20T13:00:00Z')
check('cron hour is still the 20th in Eastern', todayInZone(nineAmEastern), '2026-08-20')
check('weekday in Eastern', weekdayInZone(nineAmEastern), 'Thu')
// 00:30 UTC is still the previous evening in Eastern — the reason the digest
// resolves its own day rather than trusting the server clock.
const afterUtcMidnight = new Date('2026-08-21T00:30:00Z')
check('just past UTC midnight is still the 20th', todayInZone(afterUtcMidnight), '2026-08-20')

console.log(failures === 0 ? '\nall passed' : '\n' + failures + ' FAILED')
process.exit(failures ? 1 : 0)
