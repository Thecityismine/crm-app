import { useEffect } from 'react'
import { useContactStore } from '@/store/contactStore'
import { subscribeToContacts, getContacts, createContact, updateContact, deleteContact } from '@/lib/firebase/contacts'

let _unsub = null

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

    setLoading(true)

    // REST API fetch — reliable regardless of WebSocket/onSnapshot status.
    // This ensures contacts appear even on networks where the Firebase
    // WebSocket connection is unreliable.
    getContacts()
      .then((data) => {
        setContacts(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Initial contacts load failed:', err)
        setLoading(false)
      })

    // onSnapshot as a secondary real-time mechanism.
    // If it fires successfully it will keep the list updated.
    if (!_unsub) {
      _unsub = subscribeToContacts((data) => {
        useContactStore.getState().setContacts(data)
        useContactStore.getState().setLoading(false)
      })
    }
  }, [initialized])

  return { contacts, loading, initialized, createContact, updateContact, deleteContact }
}
