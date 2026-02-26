import { useEffect } from 'react'
import { useContactStore } from '@/store/contactStore'
import { getContacts, createContact, updateContact, deleteContact } from '@/lib/firebase/contacts'

// One fetch per browser session. Resets on page refresh (module reloads).
// Prevents Dashboard and Contacts both triggering fetches on the same load.
let _hasFetched = false

export const refreshContacts = () =>
  getContacts()
    .then((data) => useContactStore.getState().setContacts(data))
    .catch((err) => console.warn('refreshContacts failed:', err))

export const useContacts = () => {
  const { contacts } = useContactStore()

  useEffect(() => {
    if (_hasFetched) return
    _hasFetched = true

    // Fetch fresh data in the background — setContacts is guarded against
    // wiping existing contacts with an empty result (see contactStore.js).
    getContacts()
      .then((data) => useContactStore.getState().setContacts(data))
      .catch((err) => console.warn('useContacts fetch failed:', err))
  }, [])

  return { contacts, createContact, updateContact, deleteContact }
}
