import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, Activity, User, Briefcase, CheckSquare } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

const ACTIONS = [
  // Rendered bottom → top, so last item appears closest to FAB
  { type: 'new-task',     label: 'New Task',     Icon: CheckSquare, color: 'bg-orange-600 hover:bg-orange-500' },
  { type: 'new-deal',     label: 'New Deal',     Icon: Briefcase,   color: 'bg-emerald-600 hover:bg-emerald-500' },
  { type: 'new-contact',  label: 'New Contact',  Icon: User,        color: 'bg-blue-600 hover:bg-blue-500' },
  { type: 'log-activity', label: 'Log Activity', Icon: Activity,    color: 'bg-purple-600 hover:bg-purple-500' },
]

export default function QuickActionsMenu() {
  const [open, setOpen] = useState(false)
  const { openQuickAction } = useUIStore()
  const { pathname } = useLocation()

  if (pathname !== '/') return null

  const handleAction = (type) => {
    setOpen(false)
    openQuickAction(type)
  }

  return (
    <>
      {/* Click-outside backdrop */}
      {open && (
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
      )}

      {/* Speed-dial items — pointer-events:none when closed so they never block scrolling */}
      <div
        className="fixed right-5 bottom-[5.5rem] sm:bottom-24 z-40 flex flex-col items-end gap-3"
        style={{ pointerEvents: open ? 'auto' : 'none' }}
      >
        {ACTIONS.map(({ type, label, Icon, color }, i) => (
          <div
            key={type}
            className="flex items-center gap-3 transition-all duration-200"
            style={{
              opacity:         open ? 1 : 0,
              transform:       open ? 'translateY(0)' : 'translateY(12px)',
              transitionDelay: open ? `${i * 45}ms` : '0ms',
            }}
          >
            <span className="text-xs font-medium text-gray-200 bg-gray-900/95 border border-gray-700/50 px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap">
              {label}
            </span>
            <button
              onClick={() => handleAction(type)}
              className={`w-10 h-10 rounded-full ${color} flex items-center justify-center shadow-lg transition-transform hover:scale-110`}
            >
              <Icon size={16} className="text-white" />
            </button>
          </div>
        ))}
      </div>

      {/* Main FAB — always interactive, in its own fixed container */}
      <div className="fixed right-5 bottom-20 sm:bottom-8 z-40">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
            open
              ? 'bg-gray-700 hover:bg-gray-600 rotate-45'
              : 'bg-blue-600 hover:bg-blue-500'
          }`}
          aria-label="Quick actions"
        >
          <Plus size={22} className="text-white" />
        </button>
      </div>
    </>
  )
}
