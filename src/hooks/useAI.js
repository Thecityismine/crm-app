import { useState } from 'react'
import { getDealCoaching } from '@/lib/ai/dealCoach'
import { generatePreBrief } from '@/lib/ai/preBrief'
import { draftEmail } from '@/lib/ai/emailDraft'
import { naturalLanguageQuery } from '@/lib/ai/naturalQuery'

export const useAI = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const runAI = async (fn, ...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn(...args)
      return result
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    getDealCoaching: (...args) => runAI(getDealCoaching, ...args),
    generatePreBrief: (...args) => runAI(generatePreBrief, ...args),
    draftEmail: (...args) => runAI(draftEmail, ...args),
    naturalLanguageQuery: (...args) => runAI(naturalLanguageQuery, ...args),
  }
}
