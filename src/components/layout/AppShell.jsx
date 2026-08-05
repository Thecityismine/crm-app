import { Suspense, useEffect } from 'react'
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

// Matches the in-page loading style used by Deals, Pipeline and DealDetail,
// so a chunk fetch looks the same as a data fetch rather than a layout jump.
function PageFallback() {
  return (
    <div className="flex items-center justify-center py-20 text-gray-600 text-sm">
      Loading...
    </div>
  )
}

export default function AppShell() {
  const { commandBarOpen, openQuickAction, addRecentlyViewed, openCommandBar } = useUIStore()
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

  // Global keyboard shortcuts: ⌘K / Ctrl+K to search · N · D · T · L
  // Read store state directly so the handler stays stable (single registration)
  useEffect(() => {
    const handler = (e) => {
      // ⌘K works from anywhere, including while typing in a field
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        const { commandBarOpen: open, closeCommandBar } = useUIStore.getState()
        if (open) closeCommandBar()
        else openCommandBar()
        return
      }

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
  }, [openQuickAction, openCommandBar])

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar />
        {/* Bottom padding clears the mobile bottom-nav and the floating action button */}
        <main className="flex-1 overflow-y-auto px-4 py-5 pb-32 sm:p-6 sm:pb-24">
          {/* Route chunks load here, so the sidebar and top bar stay on screen */}
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav />
      {commandBarOpen && <CommandBar />}
      <QuickActionsMenu />
      <GlobalModals />
    </div>
  )
}
