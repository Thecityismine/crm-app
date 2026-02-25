import { callClaude } from './claude'

export const naturalLanguageQuery = async (query, dataContext) => {
  return callClaude({
    promptType: 'query',
    context: { availableData: dataContext },
    userMessage: query,
  })
}
