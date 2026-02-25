// All Claude API calls go through Firebase Cloud Functions to keep API key server-side
// Local dev: use a proxy or Firebase emulator

const CLOUD_FUNCTION_URL = import.meta.env.VITE_AI_FUNCTION_URL || 'http://localhost:5001/your-project/us-central1/aiProxy'

export const callClaude = async ({ promptType, context, userMessage }) => {
  const res = await fetch(CLOUD_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promptType, context, userMessage }),
  })
  if (!res.ok) throw new Error('AI request failed')
  return res.json()
}
