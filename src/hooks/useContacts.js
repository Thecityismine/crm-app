import { useEffect } from 'react'
import { useContactStore } from '@/store/contactStore'
import { subscribeToContacts, createContact, updateContact, deleteContact } from '@/lib/firebase/contacts'

export const useContacts = () => {
  const { contacts, loading, setContacts, setLoading, addContact, updateContact: update, removeContact } = useContactStore()

  useEffect(() => {
    setLoading(true)
    const unsub = subscribeToContacts((data) => {
      setContacts(data)
      setLoading(false)
    })
    return unsub
  }, [])

  return { contacts, loading, createContact, updateContact, deleteContact }
}
