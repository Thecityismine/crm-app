import { useEffect } from 'react'
import { useTaskStore } from '@/store/taskStore'
import { getTasks } from '@/lib/firebase/tasks'

// One fetch per browser session, like useContacts. Resets on page refresh
// (module reloads). The dashboard and the tasks page both want the list on the
// same load, and every write since then goes through lib/taskWrite, which keeps
// the store current — so a second fetch would only re-fetch what we already know.
let _hasFetched = false

export const refreshTasks = () =>
  getTasks()
    .then((data) => useTaskStore.getState().setTasks(data))
    .catch((err) => {
      console.warn('refreshTasks failed:', err)
      // Marks the store initialized so the page stops saying "Loading tasks..."
      // forever. setTasks is guarded against emptying a populated list, so this
      // cannot blank what's already on screen.
      useTaskStore.getState().setTasks([])
    })

export const useTasks = () => {
  const { tasks, initialized } = useTaskStore()

  useEffect(() => {
    if (_hasFetched) return
    _hasFetched = true
    refreshTasks()
  }, [])

  return { tasks, loading: !initialized }
}
