import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useUIStore = create(
  persist(
    (set) => ({
      sidebarOpen:    true,
      commandBarOpen: false,
      activeModal:    null,
      toast:          null,
      recentlyViewed: [], // [{ type, id, name, subtitle }], max 6
      quickAction:    null, // null | 'log-activity' | 'new-contact' | 'new-deal' | 'new-task'

      toggleSidebar:    () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      openCommandBar:   () => set({ commandBarOpen: true }),
      closeCommandBar:  () => set({ commandBarOpen: false }),
      openModal:        (name) => set({ activeModal: name }),
      closeModal:       () => set({ activeModal: null }),
      showToast:        (toast) => set({ toast }),
      clearToast:       () => set({ toast: null }),
      openQuickAction:  (type) => set({ quickAction: type }),
      closeQuickAction: () => set({ quickAction: null }),

      addRecentlyViewed: (item) =>
        set((s) => {
          const deduped = s.recentlyViewed.filter(
            (r) => !(r.type === item.type && r.id === item.id)
          )
          return { recentlyViewed: [item, ...deduped].slice(0, 6) }
        }),
    }),
    {
      name: 'crm-ui',
      // Only persist recently-viewed; transient UI state resets on reload
      partialize: (s) => ({ recentlyViewed: s.recentlyViewed }),
    }
  )
)
