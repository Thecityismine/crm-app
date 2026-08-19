import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useMemoryStore = create(
  persist(
    (set) => ({
      memories: [],
      loading: false,
      initialized: false,

      // Same guard the contact store carries: never let an empty result wipe a
      // populated list. A slow or failed REST fetch returning [] would
      // otherwise clear the persisted cache and blank the timeline.
      setMemories: (memories) => set((s) => ({
        memories: memories.length === 0 && s.memories.length > 0 ? s.memories : memories,
        initialized: true,
      })),

      addMemory: (memory) => set((s) => ({ memories: [memory, ...s.memories] })),
      updateMemory: (id, data) => set((s) => ({
        memories: s.memories.map((m) => (m.id === id ? { ...m, ...data } : m)),
      })),
      removeMemory: (id) => set((s) => ({ memories: s.memories.filter((m) => m.id !== id) })),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'crm-memories',
      // Only the list. Photo URLs are small; loading/initialized are transient
      // and persisting them would leave a reloaded tab thinking it had fetched.
      partialize: (state) => ({ memories: state.memories }),
    }
  )
)
