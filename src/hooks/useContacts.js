import { useEffect } from 'react'
import { useContactStore } from '@/store/contactStore'
import { subscribeToContacts, getContacts, createContact, updateContact, deleteContact } from '@/lib/firebase/contacts'

let _unsub = null

// Force an immediate REST-API read and update the store.
// Called after any write so the UI reflects the change without waiting for onSnapshot.
export const refreshContacts = () =>
  getContacts()
    .then((data) => useContactStore.getState().setContacts(data))
    .catch((err) => console.warn('refreshContacts failed:', err))

export const useContacts = () => {
  const { contacts, loading, initialized, setContacts, setLoading } = useContactStore()

  useEffect(() => {
    if (_unsub) return
    setLoading(true)
    _unsub = subscribeToContacts((data) => {
      setContacts(data)
      setLoading(false)
    })
  }, [])

  return { contacts, loading, initialized, createContact, updateContact, deleteContact }
}
