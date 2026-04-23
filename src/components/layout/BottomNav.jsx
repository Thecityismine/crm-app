import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, Kanban, CheckSquare, Globe } from 'lucide-react'

const links = [
  { to: '/',         icon: LayoutDashboard, label: 'Home'     },
  { to: '/contacts', icon: Users,           label: 'Contacts' },
  { to: '/pipeline', icon: Kanban,          label: 'Pipeline' },
  { to: '/tasks',    icon: CheckSquare,     label: 'Tasks'    },
  { to: '/map',      icon: Globe,           label: 'Map'      },
]

export default function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-800 flex bottom-nav-safe">
      {links.map(({ to, icon: Icon, label }) => {
        const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
        return (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-all duration-200 relative ${
              active ? 'text-white' : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
            )}
            <Icon size={20} style={{ transform: active ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }} />
            <span className={`text-[10px] font-medium transition-colors ${active ? 'text-blue-400' : ''}`}>
              {label}
            </span>
          </NavLink>
        )
      })}
    </nav>
  )
}
