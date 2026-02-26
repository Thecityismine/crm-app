import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Kanban, CheckSquare, Globe } from 'lucide-react'

const links = [
  { to: '/',          icon: LayoutDashboard, label: 'Home'     },
  { to: '/contacts',  icon: Users,           label: 'Contacts' },
  { to: '/pipeline',  icon: Kanban,          label: 'Pipeline' },
  { to: '/tasks',     icon: CheckSquare,     label: 'Tasks'    },
  { to: '/map',       icon: Globe,           label: 'Map'      },
]

export default function BottomNav() {
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-800 flex bottom-nav-safe">
      {links.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
              isActive ? 'text-white' : 'text-gray-600 hover:text-gray-400'
            }`
          }
        >
          <Icon size={20} />
          <span className="text-[10px] font-medium">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
