import { useState } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useAuthStore } from '@/store/authStore'
import { logout } from '@/lib/firebase/auth'
import NotificationPanel from './NotificationPanel'
import { Menu, Search, Bell, LogOut } from 'lucide-react'
import { getInitials } from '@/utils/formatters'

export default function TopBar() {
  const { toggleSidebar, openCommandBar } = useUIStore()
  const { unreadCount } = useNotificationStore()
  const { user } = useAuthStore()
  const [notifOpen, setNotifOpen] = useState(false)

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 flex-shrink-0">
      <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400">
        <Menu size={18} />
      </button>
      <button
        onClick={openCommandBar}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-500 hover:bg-gray-700 flex-1 max-w-sm"
      >
        <Search size={14} />
        Search or ask AI...
        <span className="ml-auto text-xs bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700 hidden sm:inline">⌘K</span>
      </button>
      <div className="ml-auto flex items-center gap-2">
        {/* Bell / Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
        </div>

        <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          {getInitials(user?.displayName?.split(' ')[0], user?.displayName?.split(' ')[1])}
        </div>
        <button onClick={logout} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
