// Pure digest logic. No network, no Firestore, no clock — `today` is always
// passed in, so this file is callable from a test with hand-written objects.
//
// All date math runs on 'YYYY-MM-DD' strings via Date.UTC. Nothing here touches
// the local timezone: the server runs in UTC and the user is in Eastern, so
// anything reading the host clock would drift a day for five hours each night.

import { escapeHtml } from './telegram.js'

// How many days of warning before a birthday or anniversary. The event is
// announced once at this range, then again on the day itself.
export const LEAD_DAYS = 3

// Follow-ups that are already overdue re-surface on this cadence rather than
// every morning. A bot that repeats itself daily is one you mute in a week.
const OVERDUE_REPEAT_DAYS = 7

const INTERVAL_DAYS = {
  '30 Days': 30, '60 Days': 60, '90 Days': 90, '6 Months': 180, '1 Year': 365,
}

// ── date helpers ─────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' (or an ISO timestamp) → whole days since the epoch. */
export function toDayNumber(iso) {
  if (!iso || typeof iso !== 'string') return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d || m > 12 || d > 31) return null
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

/**
 * Next occurrence of an annual date (birthday, wedding anniversary).
 * Returns { daysUntil, years } — `years` is the count being reached, so a
 * 1989 birthdate landing in 2026 gives 37.
 */
export function nextAnnual(source, today) {
  if (!source || typeof source !== 'string') return null
  const [oy, om, od] = source.slice(0, 10).split('-').map(Number)
  if (!oy || !om || !od || om > 12 || od > 31) return null

  const todayNum = toDayNumber(today)
  if (todayNum === null) return null
  const thisYear = Number(today.slice(0, 4))

  let year = thisYear
  let occurrence = Math.floor(Date.UTC(year, om - 1, od) / 86400000)
  if (occurrence < todayNum) {
    year = thisYear + 1
    occurrence = Math.floor(Date.UTC(year, om - 1, od) / 86400000)
  }

  return { daysUntil: occurrence - todayNum, years: year - oy }
}

const fullName = (c) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.fullName || 'Unnamed contact'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// An imported `nextBirthday` is an absolute date that goes stale the moment it
// passes, so `birthdate` — which carries its original year — is the real
// source. nextAnnual rolls whichever one it gets forward to the next occurrence.
const birthdaySource = (c) => c.birthdate || c.nextBirthday

// ── selectors ────────────────────────────────────────────────────────────────

export function findBirthdays(contacts, today) {
  return contacts
    .map((c) => ({ contact: c, when: nextAnnual(birthdaySource(c), today) }))
    .filter(({ when }) => when && (when.daysUntil === 0 || when.daysUntil === LEAD_DAYS))
    .sort((a, b) => a.when.daysUntil - b.when.daysUntil)
}

export function findAnniversaries(contacts, today) {
  return contacts
    .map((c) => ({ contact: c, when: nextAnnual(c.weddingAnniversary, today) }))
    .filter(({ when }) => when && (when.daysUntil === 0 || when.daysUntil === LEAD_DAYS))
    .sort((a, b) => a.when.daysUntil - b.when.daysUntil)
}

/**
 * Explicit per-contact follow-up dates (`nextFollowUp`) — the field the contact
 * cards and the in-app notification bell both read. Due today always fires;
 * already-overdue fires weekly so a stale contact doesn't nag every morning.
 */
export function findFollowUps(contacts, today) {
  const todayNum = toDayNumber(today)
  return contacts
    .map((c) => {
      const due = toDayNumber(c.nextFollowUp)
      return due === null ? null : { contact: c, daysOverdue: todayNum - due }
    })
    .filter(Boolean)
    .filter(({ daysOverdue }) =>
      daysOverdue === 0 ||
      (daysOverdue > 0 && daysOverdue % OVERDUE_REPEAT_DAYS === 0))
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
}

export function findDueTasks(tasks, today) {
  const todayNum = toDayNumber(today)
  return tasks
    .filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
    .map((t) => {
      const due = toDayNumber(t.dueDate)
      return due === null ? null : { task: t, daysOverdue: todayNum - due }
    })
    .filter(Boolean)
    .filter(({ daysOverdue }) => daysOverdue >= 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
}

/**
 * Contacts past their cadence, inferred from `interval` + `lastCommunication`.
 * This is a standing backlog rather than a dated event, so the handler only
 * asks for it on Mondays — daily would make it wallpaper.
 */
export function findNeedsAttention(contacts, today) {
  const todayNum = toDayNumber(today)
  return contacts
    .map((c) => {
      const last = toDayNumber(c.lastCommunication)
      if (last === null) return null
      const daysSince = todayNum - last
      const limit = INTERVAL_DAYS[c.interval] || 30
      return daysSince > limit ? { contact: c, daysSince, limit } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.daysSince - a.daysSince)
}

// ── message ──────────────────────────────────────────────────────────────────

function section(lines, emoji, heading, items, render, cap = 8) {
  if (!items.length) return
  lines.push('')
  lines.push(`${emoji} <b>${heading}</b>`)
  items.slice(0, cap).forEach((item) => lines.push(render(item)))
  if (items.length > cap) lines.push(`   <i>…and ${items.length - cap} more</i>`)
}

/**
 * Build the digest. `parts` holds the already-selected groups so this stays a
 * formatter. Returns null when there is nothing worth sending.
 */
export function buildDigest(today, parts) {
  const { birthdays, anniversaries, followUps, dueTasks, needsAttention } = parts

  const total = birthdays.length + anniversaries.length + followUps.length +
    dueTasks.length + needsAttention.length
  if (total === 0) return null

  const heading = new Date(today + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  })

  const lines = ['📋 <b>CRM Daily Digest</b>', `<i>${heading}</i>`]

  section(lines, '🎂', 'Birthdays', birthdays, ({ contact, when }) => {
    const name = escapeHtml(fullName(contact))
    const turning = when.years > 0 && when.years < 120 ? ` — turning ${when.years}` : ''
    return when.daysUntil === 0
      ? `   • <b>${name}</b> is today${turning}`
      : `   • ${name} in ${plural(when.daysUntil, 'day')}${turning}`
  })

  section(lines, '💍', 'Anniversaries', anniversaries, ({ contact, when }) => {
    const name = escapeHtml(fullName(contact))
    const years = when.years > 0 && when.years < 100 ? ` — ${plural(when.years, 'year')}` : ''
    return when.daysUntil === 0
      ? `   • <b>${name}</b> is today${years}`
      : `   • ${name} in ${plural(when.daysUntil, 'day')}${years}`
  })

  section(lines, '📞', 'Follow-ups', followUps, ({ contact, daysOverdue }) => {
    const name = escapeHtml(fullName(contact))
    return daysOverdue === 0
      ? `   • <b>${name}</b> — due today`
      : `   • ${name} — <b>${plural(daysOverdue, 'day')} overdue</b>`
  })

  section(lines, '✅', 'Tasks', dueTasks, ({ task, daysOverdue }) => {
    const title = escapeHtml(task.title || 'Untitled task')
    const who = task.contactName ? ` — ${escapeHtml(task.contactName)}` : ''
    return daysOverdue === 0
      ? `   🟡 ${title}${who} (today)`
      : `   🔴 ${title}${who} (${plural(daysOverdue, 'day')} overdue)`
  }, 5)

  section(lines, '💬', 'Out of touch', needsAttention, ({ contact, daysSince }) =>
    `   • ${escapeHtml(fullName(contact))} — ${plural(daysSince, 'day')} ago`, 5)

  return lines.join('\n')
}
