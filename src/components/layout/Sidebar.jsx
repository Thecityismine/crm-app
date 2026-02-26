import { NavLink } from 'react-router-dom'
import { useUIStore } from '@/store/uiStore'
import {
  LayoutDashboard, Users, Building2, Briefcase, Kanban,
  MapPin, CheckSquare, Mail, BarChart2, Settings, Globe, X
} from 'lucide-react'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/companies', icon: Building2, label: 'Companies' },
  { to: '/deals', icon: Briefcase, label: 'Deals' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/properties', icon: MapPin, label: 'Properties' },
  { to: '/map', icon: Globe, label: 'Map' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/emails', icon: Mail, label: 'Emails' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
]

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore()

  const handleLinkClick = () => {
    if (window.innerWidth < 640) toggleSidebar()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="sm:hidden fixed inset-0 bg-black/60 z-30"
          onClick={toggleSidebar}
        />
      )}

      <aside className={`
        ${sidebarOpen ? 'flex' : 'hidden'}
        fixed sm:static inset-y-0 left-0
        z-50 sm:z-auto
        flex-col w-64 sm:w-56 h-screen sm:h-auto
        bg-gray-900 border-r border-gray-800
      `}>
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-800 flex-shrink-0">
          <span className="font-bold text-white text-lg tracking-tight">CRM</span>
          <button
            onClick={toggleSidebar}
            className="sm:hidden p-1 text-gray-500 hover:text-gray-300"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 pb-safe border-t border-gray-800 flex-shrink-0">
          <NavLink
            to="/settings"
            onClick={handleLinkClick}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Settings size={16} />
            Settings
          </NavLink>
        </div>
      </aside>
    </>
  )
}
