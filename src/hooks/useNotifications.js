import { useEffect } from 'react'
import { useContactStore } from '@/store/contactStore'
import { useNotificationStore } from '@/store/notificationStore'
import { getTasks } from '@/lib/firebase/tasks'

export function useNotifications() {
  const { contacts } = useContactStore()
  const setNotifications = useNotificationStore((s) => s.setNotifications)

  useEffect(() => {
    if (!contacts.length) return

    const notifs = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // ── Overdue follow-ups ───────────────────────────────────────────────
    contacts.forEach((c) => {
      if (!c.nextFollowUp) return
      const due = new Date(c.nextFollowUp)
      due.setHours(0, 0, 0, 0)
      const diff = Math.round((due - today) / 86400000)
      if (diff < 0) {
        notifs.push({
          id: `followup_${c.id}`,
          type: 'followup',
          title: `Follow up with ${c.firstName} ${c.lastName}`,
          subtitle: `${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''} overdue`,
          contactId: c.id,
          isRead: false,
          priority: diff < -7 ? 'high' : 'medium',
        })
      }
    })

    // ── Birthdays in next 7 days ─────────────────────────────────────────
    contacts.forEach((c) => {
      if (!c.birthdate) return
      const birth = new Date(c.birthdate + 'T12:00:00')
      if (isNaN(birth.getTime())) return
      const next = new Date(birth)
      next.setFullYear(today.getFullYear())
      if (next < today) next.setFullYear(today.getFullYear() + 1)
      const diff = Math.round((next - today) / 86400000)
      if (diff <= 7) {
        notifs.push({
          id: `birthday_${c.id}`,
          type: 'birthday',
          title: `${c.firstName} ${c.lastName}'s birthday`,
          subtitle: diff === 0 ? 'Today!' : diff === 1 ? 'Tomorrow' : `In ${diff} days`,
          contactId: c.id,
          isRead: false,
          priority: diff <= 1 ? 'high' : 'medium',
        })
      }
    })

    // ── Overdue tasks ────────────────────────────────────────────────────
    getTasks()
      .then((tasks) => {
        tasks.forEach((t) => {
          if (t.status === 'completed' || !t.dueDate) return
          const due = new Date(t.dueDate + 'T12:00:00')
          if (due < today) {
            notifs.push({
              id: `task_${t.id}`,
              type: 'task',
              title: t.title,
              subtitle: 'Task overdue',
              taskId: t.id,
              isRead: false,
              priority: t.priority === 'urgent' ? 'high' : 'medium',
            })
          }
        })
        finish(notifs)
      })
      .catch(() => finish(notifs))
  }, [contacts])

  function finish(notifs) {
    // Preserve read state from this session
    const readIds = new Set(
      useNotificationStore.getState().notifications.filter((n) => n.isRead).map((n) => n.id)
    )
    const sorted = notifs
      .map((n) => ({ ...n, isRead: readIds.has(n.id) }))
      .sort((a, b) => {
        const p = { high: 0, medium: 1, low: 2 }
        return (p[a.priority] ?? 1) - (p[b.priority] ?? 1)
      })
    setNotifications(sorted)
  }
}
