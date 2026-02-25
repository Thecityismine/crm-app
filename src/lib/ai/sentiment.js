import { callClaude } from './claude'

export const analyzeSentiment = async (emailBody) => {
  return callClaude({
    promptType: 'sentiment',
    context: { email: emailBody },
    userMessage: 'Analyze the sentiment of this email. Return a score from -1 (very negative) to 1 (very positive) and a label.',
  })
}
