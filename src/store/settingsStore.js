import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { loadUserSettings, saveUserSettings } from '@/lib/firebase/userSettings'

const DEFAULT_RELATIONSHIPS = [
  'Architect', 'MEP Engineer', 'Contractor', 'Engineer', 'Friend', 'Family',
  'Consultant', 'Work Colleague', 'Doctor',
]

const DEFAULT_INDUSTRIES = [
  'Real Estate', 'Finance', 'Banking', 'Law', 'Consulting', 'Technology',
  'Healthcare', 'Construction', 'Architecture', 'Insurance', 'Government', 'Other',
]

export const PIPELINE_TEMPLATES = {
  default:     ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
  leasing:     ['Prospect', 'Showing', 'Application', 'Lease Out', 'Closed', 'Lost'],
  acquisition: ['Sourcing', 'LOI', 'Due Diligence', 'Under Contract', 'Closed', 'Dead'],
  development: ['Land', 'Entitlement', 'Design', 'Construction', 'Lease-Up', 'Completed'],
  lending:     ['Inquiry', 'Term Sheet', 'Processing', 'Underwriting', 'Funded', 'Declined'],
}

// Extract only the serialisable settings (no functions)
function settingsPayload(state) {
  return {
    relationshipOptions: state.relationshipOptions,
    industryOptions:     state.industryOptions,
    pipelineTemplate:    state.pipelineTemplate,
    notificationPrefs:   state.notificationPrefs,
  }
}

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      relationshipOptions: DEFAULT_RELATIONSHIPS,
      industryOptions:     DEFAULT_INDUSTRIES,
      pipelineTemplate: 'default',
      notificationPrefs: {
        followUpReminders: true,
        dealAlerts:        true,
        weeklyDigest:      false,
      },

      // Returns the stage list for the currently selected template
      getPipelineStages: () =>
        PIPELINE_TEMPLATES[get().pipelineTemplate] || PIPELINE_TEMPLATES.default,

      // Fetch from Firestore and override localStorage — call on Settings mount
      syncFromFirestore: async () => {
        const data = await loadUserSettings().catch(() => null)
        if (!data) return
        const update = {}
        if (data.relationshipOptions?.length) update.relationshipOptions = data.relationshipOptions
        if (data.industryOptions?.length)     update.industryOptions     = data.industryOptions
        if (data.pipelineTemplate)            update.pipelineTemplate    = data.pipelineTemplate
        if (data.notificationPrefs)           update.notificationPrefs   = data.notificationPrefs
        if (Object.keys(update).length)       set(update)
      },

      addRelationshipOption: async (label) => {
        const trimmed = label.trim()
        if (!trimmed) return
        const next = [...get().relationshipOptions, trimmed]
        set({ relationshipOptions: next })
        saveUserSettings(settingsPayload({ ...get(), relationshipOptions: next })).catch(console.error)
      },

      removeRelationshipOption: async (label) => {
        const next = get().relationshipOptions.filter((r) => r !== label)
        set({ relationshipOptions: next })
        saveUserSettings(settingsPayload({ ...get(), relationshipOptions: next })).catch(console.error)
      },

      addIndustryOption: async (label) => {
        const trimmed = label.trim()
        if (!trimmed) return
        const next = [...get().industryOptions, trimmed]
        set({ industryOptions: next })
        saveUserSettings(settingsPayload({ ...get(), industryOptions: next })).catch(console.error)
      },

      removeIndustryOption: async (label) => {
        const next = get().industryOptions.filter((i) => i !== label)
        set({ industryOptions: next })
        saveUserSettings(settingsPayload({ ...get(), industryOptions: next })).catch(console.error)
      },

      setPipelineTemplate: async (template) => {
        set({ pipelineTemplate: template })
        saveUserSettings(settingsPayload({ ...get(), pipelineTemplate: template })).catch(console.error)
      },

      setNotificationPref: async (key, value) => {
        const next = { ...get().notificationPrefs, [key]: value }
        set({ notificationPrefs: next })
        saveUserSettings(settingsPayload({ ...get(), notificationPrefs: next })).catch(console.error)
      },
    }),
    { name: 'crm-settings' }
  )
)
