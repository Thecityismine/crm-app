import { useEffect } from 'react'
import { useContactStore } from '@/store/contactStore'
import { getContacts, createContact, updateContact, deleteContact } from '@/lib/firebase/contacts'

// Prevent concurrent background fetches (e.g. user navigates away and back
// before the first fetch completes, which would start a second one).
let _fetching = false

// Safely update the store: never replace a populated list with an empty result.
// An empty result means either auth isn't ready yet or the network returned
// nothing useful — in either case we keep the cached contacts visible.
function safeSetContacts(data) {
  const current = useContactStore.getState().contacts
  if (data.length === 0 && current.length > 0) {
    console.warn('getContacts returned 0 results — keeping cached contacts.')
    useContactStore.getState().setLoading(false)
    // Still mark initialized so we don't keep re-fetching
    useContactStore.getState().setContacts(current)
    return
  }
  useContactStore.getState().setContacts(data)
}

// Force a REST API read and update the store.
// Used after writes and to re-sync after a long idle period.
export const refreshContacts = () =>
  getContacts()
    .then((data) => safeSetContacts(data))
    .catch((err) => console.warn('refreshContacts failed:', err))

export const useContacts = () => {
  const { contacts, loading, initialized, setContacts, setLoading } = useContactStore()

  useEffect(() => {
    if (initialized) return
    if (_fetching) return   // already in-flight — don't start a second fetch

    _fetching = true
    if (contacts.length === 0) setLoading(true)

    getContacts()
      .then((data) => {
        _fetching = false
        safeSetContacts(data)
        setLoading(false)
      })
      .catch((err) => {
        _fetching = false
        console.error('Initial contacts load failed:', err)
        setLoading(false)
      })
  }, [initialized])

  return { contacts, loading, initialized, createContact, updateContact, deleteContact }
}
