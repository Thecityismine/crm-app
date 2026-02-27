import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import CommandBar from './CommandBar'
import QuickActionsMenu from './QuickActionsMenu'
import GlobalModals from './GlobalModals'
import { useUIStore } from '@/store/uiStore'
import { useContactStore } from '@/store/contactStore'
import { useNotifications } from '@/hooks/useNotifications'

export default function AppShell() {
  const { commandBarOpen, openQuickAction, addRecentlyViewed } = useUIStore()
  const { contacts } = useContactStore()
  const location = useLocation()
  useNotifications()

  // Track recently-viewed contacts when navigating to a contact detail page
  useEffect(() => {
    const match = location.pathname.match(/^\/contacts\/([^/]+)$/)
    if (!match) return
    const contact = contacts.find((c) => c.id === match[1])
    if (contact) {
      addRecentlyViewed({
        type:     'contact',
        id:       contact.id,
        name:     `${contact.firstName} ${contact.lastName}`.trim(),
        subtitle: contact.company || contact.title || null,
      })
    }
  }, [location.pathname, contacts])

  // Global keyboard shortcuts: N · D · T · L
  // Read store state directly so the handler stays stable (single registration)
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName
      if (
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
        e.target.isContentEditable
      ) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const { commandBarOpen: open, quickAction } = useUIStore.getState()
      if (open || quickAction) return

      switch (e.key) {
        case 'n': case 'N': e.preventDefault(); openQuickAction('new-contact');  break
        case 'd': case 'D': e.preventDefault(); openQuickAction('new-deal');     break
        case 't': case 'T': e.preventDefault(); openQuickAction('new-task');     break
        case 'l': case 'L': e.preventDefault(); openQuickAction('log-activity'); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openQuickAction])

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 pb-28 sm:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      {commandBarOpen && <CommandBar />}
      <QuickActionsMenu />
      <GlobalModals />
    </div>
  )
}
