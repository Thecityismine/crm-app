import { callClaude } from './claude'

export const generatePreBrief = async ({ contact, deal, activities, upcomingMeeting }) => {
  return callClaude({
    promptType: 'pre_brief',
    context: { contact, deal, recentActivities: activities.slice(0, 5), upcomingMeeting },
    userMessage: 'Generate a pre-meeting brief for this contact.',
  })
}
