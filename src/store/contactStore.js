import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useContactStore = create(
  persist(
    (set) => ({
      contacts: [],
      selectedContact: null,
      loading: false,
      initialized: false,
      // Never wipe a populated list with an empty result — guards against slow/
      // failed REST fetches returning [] and clearing the persisted cache.
      setContacts: (contacts) => set((s) => ({
        contacts: contacts.length === 0 && s.contacts.length > 0 ? s.contacts : contacts,
        initialized: true,
      })),
      setSelectedContact: (contact) => set({ selectedContact: contact }),
      addContact: (contact) => set((s) => ({ contacts: [contact, ...s.contacts] })),
      updateContact: (id, data) => set((s) => ({
        contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...data } : c)),
      })),
      removeContact: (id) => set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'crm-contacts',
      // Only persist the contacts list — never persist loading/initialized flags
      partialize: (state) => ({ contacts: state.contacts }),
    }
  )
)
