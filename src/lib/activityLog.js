// Logging an activity, in one place.
//
// This ran in four: the contact's own timeline, the contacts list, the
// dashboard, and the global quick-action modal. Three of them kept the shared
// contact store in step; the one on the contact's own page updated only that
// page's local state, so logging a call there left the dashboard, the contact
// list and every health badge reading a stale lastCommunication until a full
// refetch. That is the bug this file exists to stop recurring.
//
// They also disagreed on the stored format — one wrote a full ISO timestamp,
// another a bare date — which meant the same field meant different things
// depending on where it was written from.

import { logActivity } from '@/lib/firebase/activities'
import { updateContact } from '@/lib/firebase/contacts'
import { useContactStore } from '@/store/contactStore'
import { toDateKey, toDateTimeValue } from '@/lib/dates'

/** Activity types that count as having spoken to someone. */
export const COMMUNICATION_TYPES = new Set(['call', 'email', 'meeting', 'sms', 'note'])

// Both re-exported from @/lib/dates, which is where this app keeps its
// calendar-date reasoning and the record of what goes wrong without it.
export const localDateTimeValue = toDateTimeValue
export const toLocalDateOnly = toDateKey

/**
 * Record an activity against a contact and, when it counts as communication,
 * bring lastCommunication forward everywhere at once — Firestore and the shared
 * store, so no view is left showing the old value.
 *
 * @returns the patch applied to the contact, or null if the type wasn't a
 *          communication. Callers use it to update their own local copy.
 */
export async function logContactActivity(contactId, data) {
  await logActivity(contactId, data)

  if (!COMMUNICATION_TYPES.has(data.type)) return null

  const lastCommunication = toLocalDateOnly(data.occurredAt)
  if (!lastCommunication) return null

  const patch = { lastCommunication }
  await updateContact(contactId, patch)
  useContactStore.getState().updateContact(contactId, patch)
  return patch
}
