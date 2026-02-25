import { useEffect } from 'react'
import { useContactStore } from '@/store/contactStore'
import { subscribeToContacts, getContacts, createContact, updateContact, deleteContact } from '@/lib/firebase/contacts'

// Module-level singleton — only one Firestore listener for the entire app session.
// Prevents re-fetching all contacts every time the Contacts page is visited.
let _unsub = null

// After any write via the server-side REST proxy, the onSnapshot long-polling
// listener may take a while to detect the change. This forces an immediate
// one-time read to keep the UI in sync.
export const refreshContacts = async () => {
  const { setContacts } = useContactStore.getState()
  const data = await getContacts()
  setContacts(data)
}

export const useContacts = () => {
  const { contacts, loading, initialized, setContacts, setLoading } = useContactStore()

  useEffect(() => {
    // Already subscribed — contacts are in the store, nothing to do.
    if (_unsub) return

    setLoading(true)
    _unsub = subscribeToContacts((data) => {
      setContacts(data)
      setLoading(false)
    })

    // Intentionally not returning _unsub — keep the listener alive across
    // page navigations so contacts are instant on re-visit.
  }, [])

  return { contacts, loading, initialized, createContact, updateContact, deleteContact }
}
