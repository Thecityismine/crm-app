import { useEffect } from 'react'
import { useTaskStore } from '@/store/taskStore'
import { useAuthStore } from '@/store/authStore'
import { subscribeToMyTasks, createTask, updateTask, completeTask } from '@/lib/firebase/tasks'

export const useTasks = () => {
  const { user } = useAuthStore()
  const { tasks, setTasks } = useTaskStore()

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToMyTasks(user.uid, setTasks)
    return unsub
  }, [user])

  return { tasks, createTask, updateTask, completeTask }
}
