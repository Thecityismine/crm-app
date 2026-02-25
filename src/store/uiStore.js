import { create } from 'zustand'

export const useUIStore = create((set) => ({
  sidebarOpen: true,
  commandBarOpen: false,
  activeModal: null,
  toast: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openCommandBar: () => set({ commandBarOpen: true }),
  closeCommandBar: () => set({ commandBarOpen: false }),
  openModal: (name) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
}))
