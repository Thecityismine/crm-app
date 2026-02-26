import { useEffect } from 'react'
import { useContactStore } from '@/store/contactStore'
import { getContacts, createContact, updateContact, deleteContact } from '@/lib/firebase/contacts'

// Force a REST API read and update the store.
// Used after writes and to re-sync after a long idle period.
export const refreshContacts = () =>
  getContacts()
    .then((data) => useContactStore.getState().setContacts(data))
    .catch((err) => console.warn('refreshContacts failed:', err))

export const useContacts = () => {
  const { contacts, loading, initialized, setContacts, setLoading } = useContactStore()

  useEffect(() => {
    if (initialized) return

    // Only show the loading spinner when there are no cached contacts.
    // When contacts are already in localStorage, fetch silently in the background.
    if (contacts.length === 0) setLoading(true)

    getContacts()
      .then((data) => {
        setContacts(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Initial contacts load failed:', err)
        setLoading(false)
      })
  }, [initialized])

  return { contacts, loading, initialized, createContact, updateContact, deleteContact }
}
