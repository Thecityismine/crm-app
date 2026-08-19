import { useEffect } from 'react'
import { useMemoryStore } from '@/store/memoryStore'
import { useAuthStore } from '@/store/authStore'
import { auth } from '@/config/firebase'
import {
  getMemories, createMemory, updateMemory, deleteMemory,
} from '@/lib/firebase/memories'

// One fetch per browser session, like the contact hook — resets on refresh so
// several pages mounting at once don't each trigger a round trip.
let _hasFetched = false

async function fetchInto() {
  const uid = auth.currentUser?.uid || null
  if (!uid) return

  const { ownerUid, resetMemories } = useMemoryStore.getState()

  // Only a KNOWN different account clears the cache. These are private, so a
  // shared browser must not show one account's timeline to the next — but a
  // null uid means Firebase hasn't restored the session yet, not that the owner
  // changed, and clearing on that would blank the timeline on every cold load
  // that outran the auth restore.
  if (ownerUid && ownerUid !== uid) resetMemories(uid)

  const data = await getMemories()
  useMemoryStore.getState().setMemories(data, uid)
}

export const refreshMemories = () =>
  fetchInto().catch((err) => console.warn('refreshMemories failed:', err))

export const useMemories = () => {
  const { memories, initialized } = useMemoryStore()
  // Gate on the auth store rather than firing on mount: auth.currentUser is
  // null until Firebase restores the session, and a mount-time fetch would
  // race it and quietly fetch nothing.
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!user || _hasFetched) return
    _hasFetched = true
    fetchInto().catch((err) => console.warn('useMemories fetch failed:', err))
  }, [user])

  return { memories, initialized, createMemory, updateMemory, deleteMemory }
}
