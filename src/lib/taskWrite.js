// Creating, completing and deleting a task, in one place.
//
// Three screens showed tasks — the tasks page, the dashboard, and the global
// "New Task" quick action — and each kept its own copy in local state. The
// quick-action modal wrote to Firestore and told none of them: clicking Create
// closed the window and changed nothing on screen, so the task looked lost. It
// only surfaced when something remounted and refetched, which is why a second
// attempt appeared to be the one that worked — and why it left a duplicate
// behind. That is the bug this file exists to stop recurring. Every write goes
// through here, and here updates the shared store alongside Firestore.
//
// The same shape as lib/activityLog, for the same reason.

import { createTask, updateTask, deleteTask } from '@/lib/firebase/tasks'
import { useTaskStore } from '@/store/taskStore'
import { isRecurring, nextDueDate } from '@/lib/recurrence'

/**
 * Create a task and put it on screen everywhere at once.
 * @returns the stored task, id included.
 */
export async function addTask(data) {
  const { id } = await createTask(data)
  const task = { id, ...data }
  useTaskStore.getState().addTask(task)
  return task
}

/**
 * Apply a patch to the store first, then Firestore. If the write fails the
 * patched fields are put back and the error is rethrown, so no view is left
 * showing a change that never landed.
 */
export async function patchTask(id, patch) {
  const before = useTaskStore.getState().tasks.find((t) => t.id === id)
  useTaskStore.getState().updateTask(id, patch)
  try {
    await updateTask(id, patch)
  } catch (err) {
    if (before) {
      // Restore only what the patch touched. Anything else may have changed for
      // good reason while the write was in flight.
      const undo = {}
      for (const key of Object.keys(patch)) undo[key] = before[key] ?? null
      useTaskStore.getState().updateTask(id, undo)
    }
    throw err
  }
}

/**
 * Mark a task done, and open the next one if it repeats.
 *
 * The finished instance is kept rather than moved forward, so the Done tab is a
 * record of what actually got done and not a single row that has been recycled
 * all year. Only completion spawns — re-opening a task must not, or ticking a
 * box twice would leave a stray copy behind every time.
 *
 * @returns the newly opened task, or null when nothing repeats.
 */
export async function completeTask(task) {
  await patchTask(task.id, { status: 'completed' })
  if (!isRecurring(task)) return null

  const dueDate = nextDueDate(task.dueDate, task.recurrence)
  if (!dueDate) return null

  // Carry the task's own fields forward; drop what belongs to the instance that
  // was just closed out.
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = task
  return addTask({ ...rest, status: 'open', dueDate })
}

/** Delete a task, restoring the list in place if the delete fails. */
export async function dropTask(id) {
  const before = useTaskStore.getState().tasks
  useTaskStore.getState().removeTask(id)
  try {
    await deleteTask(id)
  } catch (err) {
    useTaskStore.getState().setTasks(before)
    throw err
  }
}
