import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_RELATIONSHIPS = [
  'Architect', 'Engineer', 'Contractor', 'Friend', 'Family',
  'Consultant', 'Work Colleague', 'Doctor',
]

export const useSettingsStore = create(
  persist(
    (set) => ({
      relationshipOptions: DEFAULT_RELATIONSHIPS,
      addRelationshipOption: (label) =>
        set((s) => ({ relationshipOptions: [...s.relationshipOptions, label.trim()] })),
      removeRelationshipOption: (label) =>
        set((s) => ({ relationshipOptions: s.relationshipOptions.filter((r) => r !== label) })),
    }),
    { name: 'crm-settings' }
  )
)
