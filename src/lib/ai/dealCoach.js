import { callClaude } from './claude'

export const getDealCoaching = async (deal, contacts, activities) => {
  return callClaude({
    promptType: 'deal_coach',
    context: { deal, contacts, recentActivities: activities.slice(0, 10) },
    userMessage: 'Analyze this deal and provide coaching: risk flags, next best action, and win probability assessment.',
  })
}
