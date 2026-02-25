import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { loadUserSettings, saveUserSettings } from '@/lib/firebase/userSettings'

const DEFAULT_RELATIONSHIPS = [
  'Architect', 'Engineer', 'Contractor', 'Friend', 'Family',
  'Consultant', 'Work Colleague', 'Doctor',
]

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      relationshipOptions: DEFAULT_RELATIONSHIPS,

      // Fetch from Firestore and override localStorage — call on Settings mount
      syncFromFirestore: async () => {
        const data = await loadUserSettings().catch(() => null)
        if (data?.relationshipOptions?.length) {
          set({ relationshipOptions: data.relationshipOptions })
        }
      },

      addRelationshipOption: async (label) => {
        const trimmed = label.trim()
        if (!trimmed) return
        const next = [...get().relationshipOptions, trimmed]
        set({ relationshipOptions: next })
        saveUserSettings({ relationshipOptions: next }).catch(console.error)
      },

      removeRelationshipOption: async (label) => {
        const next = get().relationshipOptions.filter((r) => r !== label)
        set({ relationshipOptions: next })
        saveUserSettings({ relationshipOptions: next }).catch(console.error)
      },
    }),
    { name: 'crm-settings' }
  )
)
