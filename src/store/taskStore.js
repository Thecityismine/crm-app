import { create } from 'zustand'

// Deliberately not persisted. A stale task list is worse than an empty one — a
// task you already completed reappearing as open is a lie about what you still
// owe, and unlike contacts there is no offline value in holding the last copy.
export const useTaskStore = create((set) => ({
  tasks: [],
  initialized: false,

  // Never wipe a populated list with an empty result — guards against a slow or
  // failed REST fetch returning [] and blanking the page. Same guard, same
  // reason as contactStore. It doubles as the "we tried" signal: a failed fetch
  // calls setTasks([]) to clear `loading` without touching what's on screen.
  setTasks: (tasks) => set((s) => ({
    tasks: tasks.length === 0 && s.tasks.length > 0 ? s.tasks : tasks,
    initialized: true,
  })),

  addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),
  updateTask: (id, data) => set((s) => ({
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...data } : t)),
  })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
}))
