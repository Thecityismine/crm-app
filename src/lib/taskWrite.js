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
