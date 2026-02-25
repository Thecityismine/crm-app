import { NavLink } from 'react-router-dom'
import { useUIStore } from '@/store/uiStore'
import {
  LayoutDashboard, Users, Building2, Briefcase, Kanban,
  MapPin, CheckSquare, Mail, BarChart2, Settings
} from 'lucide-react'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/companies', icon: Building2, label: 'Companies' },
  { to: '/deals', icon: Briefcase, label: 'Deals' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/properties', icon: MapPin, label: 'Properties' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/emails', icon: Mail, label: 'Emails' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
]

export default function Sidebar() {
  const { sidebarOpen } = useUIStore()
  if (!sidebarOpen) return null
  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-gray-800">
        <span className="font-bold text-white text-lg tracking-tight">CRM</span>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-800">
        <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Settings size={16} />
          Settings
        </NavLink>
      </div>
    </aside>
  )
}
