import { create } from 'zustand'

export const useTaskStore = create((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),
  updateTask: (id, data) => set((s) => ({
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...data } : t)),
  })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
}))
