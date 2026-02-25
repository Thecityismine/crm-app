import { create } from 'zustand'

export const useDealStore = create((set) => ({
  deals: [],
  selectedDeal: null,
  loading: false,
  setDeals: (deals) => set({ deals }),
  setSelectedDeal: (deal) => set({ selectedDeal: deal }),
  addDeal: (deal) => set((s) => ({ deals: [deal, ...s.deals] })),
  updateDeal: (id, data) => set((s) => ({
    deals: s.deals.map((d) => (d.id === id ? { ...d, ...data } : d)),
  })),
  removeDeal: (id) => set((s) => ({ deals: s.deals.filter((d) => d.id !== id) })),
  setLoading: (loading) => set({ loading }),
}))
