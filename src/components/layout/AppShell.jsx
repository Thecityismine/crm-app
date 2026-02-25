import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import CommandBar from './CommandBar'
import { useUIStore } from '@/store/uiStore'

export default function AppShell() {
  const { sidebarOpen, commandBarOpen } = useUIStore()
  return (
    <div className="flex h-screen bg-black overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      {commandBarOpen && <CommandBar />}
    </div>
  )
}
