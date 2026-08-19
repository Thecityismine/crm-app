import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useMemoryStore = create(
  persist(
    (set) => ({
      memories: [],
      // Whose memories these are. The other stores hold data every signed-in
      // user may read, so a stale cache is only stale. These are private, and
      // a shared browser would otherwise show one account's memories to the
      // next one until the fetch landed.
      ownerUid: null,
      loading: false,
      initialized: false,

      // Same guard the contact store carries: never let an empty result wipe a
      // populated list. A slow or failed REST fetch returning [] would
      // otherwise clear the persisted cache and blank the timeline.
      setMemories: (memories, uid = null) => set((s) => ({
        memories: memories.length === 0 && s.memories.length > 0 ? s.memories : memories,
        ownerUid: uid ?? s.ownerUid,
        initialized: true,
      })),

      // Drop everything, for a sign-out or a different account. Deliberately
      // bypasses the empty-result guard above — this one means it.
      resetMemories: (uid = null) => set({ memories: [], ownerUid: uid, initialized: false }),

      addMemory: (memory) => set((s) => ({ memories: [memory, ...s.memories] })),
      updateMemory: (id, data) => set((s) => ({
        memories: s.memories.map((m) => (m.id === id ? { ...m, ...data } : m)),
      })),
      removeMemory: (id) => set((s) => ({ memories: s.memories.filter((m) => m.id !== id) })),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'crm-memories',
      // The list and whose it is. loading/initialized are transient — persisting
      // them would leave a reloaded tab thinking it had already fetched.
      partialize: (state) => ({ memories: state.memories, ownerUid: state.ownerUid }),
    }
  )
)
