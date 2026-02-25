import { useUIStore } from '@/store/uiStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useAuthStore } from '@/store/authStore'
import { logout } from '@/lib/firebase/auth'
import { Menu, Search, Bell, LogOut } from 'lucide-react'
import { getInitials } from '@/utils/formatters'

export default function TopBar() {
  const { toggleSidebar, openCommandBar } = useUIStore()
  const { unreadCount } = useNotificationStore()
  const { user } = useAuthStore()

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3">
      <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400">
        <Menu size={18} />
      </button>
      <button
        onClick={openCommandBar}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-500 hover:bg-gray-700 flex-1 max-w-sm"
      >
        <Search size={14} />
        Search or ask AI...
        <span className="ml-auto text-xs bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700">⌘K</span>
      </button>
      <div className="ml-auto flex items-center gap-2">
        <button className="relative p-1.5 rounded-lg hover:bg-gray-800 text-gray-400">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
        <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
          {getInitials(user?.displayName?.split(' ')[0], user?.displayName?.split(' ')[1])}
        </div>
        <button onClick={logout} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
