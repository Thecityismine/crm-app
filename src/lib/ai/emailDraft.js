import { callClaude } from './claude'

export const draftEmail = async ({ contact, deal, context, instruction }) => {
  return callClaude({
    promptType: 'email_draft',
    context: { contact, deal, recentContext: context },
    userMessage: instruction || 'Draft a professional follow-up email.',
  })
}
