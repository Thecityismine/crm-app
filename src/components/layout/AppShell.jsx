import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import CommandBar from './CommandBar'
import { useUIStore } from '@/store/uiStore'
import { useNotifications } from '@/hooks/useNotifications'

export default function AppShell() {
  const { commandBarOpen } = useUIStore()
  useNotifications()

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 pb-20 sm:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      {commandBarOpen && <CommandBar />}
    </div>
  )
}
