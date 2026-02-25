import { create } from 'zustand'

export const useContactStore = create((set) => ({
  contacts: [],
  selectedContact: null,
  loading: false,
  initialized: false,
  setContacts: (contacts) => set({ contacts, initialized: true }),
  setSelectedContact: (contact) => set({ selectedContact: contact }),
  addContact: (contact) => set((s) => ({ contacts: [contact, ...s.contacts] })),
  updateContact: (id, data) => set((s) => ({
    contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...data } : c)),
  })),
  removeContact: (id) => set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),
  setLoading: (loading) => set({ loading }),
}))
