import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/store/uiStore'
import { useContactStore } from '@/store/contactStore'
import {
  Search, X, User, Briefcase, CheckSquare, Activity,
  LayoutDashboard, Users, Building2, FileText, BarChart2,
  Settings, Clock, Map, GitBranch,
} from 'lucide-react'

const NAV_COMMANDS = [
  { label: 'Dashboard',  path: '/',          Icon: LayoutDashboard },
  { label: 'Contacts',   path: '/contacts',  Icon: Users },
  { label: 'Pipeline',   path: '/pipeline',  Icon: GitBranch },
  { label: 'Deals',      path: '/deals',     Icon: Briefcase },
  { label: 'Tasks',      path: '/tasks',     Icon: CheckSquare },
  { label: 'Companies',  path: '/companies', Icon: Building2 },
  { label: 'Map',        path: '/map',       Icon: Map },
  { label: 'Reports',    path: '/reports',   Icon: BarChart2 },
  { label: 'Settings',   path: '/settings',  Icon: Settings },
]

const QUICK_ACTIONS = [
  { label: 'Log Activity', type: 'log-activity', Icon: Activity,    shortcut: 'L' },
  { label: 'New Contact',  type: 'new-contact',  Icon: User,        shortcut: 'N' },
  { label: 'New Deal',     type: 'new-deal',     Icon: Briefcase,   shortcut: 'D' },
  { label: 'New Task',     type: 'new-task',     Icon: CheckSquare, shortcut: 'T' },
]

function SectionLabel({ label }) {
  return (
    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-600 uppercase tracking-wider select-none">
      {label}
    </p>
  )
}

function ResultRow({ Icon, label, subtitle, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-gray-800/70 transition-colors"
    >
      {Icon && <Icon size={14} className="text-gray-500 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300 truncate">{label}</p>
        {subtitle && <p className="text-xs text-gray-600 truncate mt-0.5">{subtitle}</p>}
      </div>
      {badge && (
        <span className="text-xs text-gray-700 border border-gray-800 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
          {badge}
        </span>
      )}
    </button>
  )
}

export default function CommandBar() {
  const { closeCommandBar, recentlyViewed, openQuickAction } = useUIStore()
  const { contacts } = useContactStore()
  const [query, setQuery] = useState('')
  const inputRef = useRef()
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') closeCommandBar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const q = query.toLowerCase().trim()

  const contactResults = useMemo(() => {
    if (!q) return []
    return contacts
      .filter((c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      )
      .slice(0, 6)
  }, [contacts, q])

  const navResults  = NAV_COMMANDS.filter((c)  => !q || c.label.toLowerCase().includes(q))
  const actionResults = QUICK_ACTIONS.filter((a) => !q || a.label.toLowerCase().includes(q))
  const hasAny = contactResults.length || navResults.length || actionResults.length || recentlyViewed.length

  const goTo = (path) => { navigate(path); closeCommandBar() }
  const act  = (type) => { closeCommandBar(); openQuickAction(type) }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) closeCommandBar() }}
    >
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-800">

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <Search size={15} className="text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts or navigate..."
            className="flex-1 outline-none text-sm bg-transparent text-gray-100 placeholder-gray-600"
          />
          {query
            ? <button onClick={() => setQuery('')} className="text-gray-600 hover:text-gray-400 p-0.5"><X size={14} /></button>
            : <kbd className="text-xs text-gray-700 border border-gray-800 px-1.5 py-0.5 rounded">Esc</kbd>
          }
        </div>

        {/* Results */}
        <div className="py-1 max-h-[360px] overflow-y-auto">

          {/* Contact search results */}
          {contactResults.length > 0 && (
            <>
              <SectionLabel label="Contacts" />
              {contactResults.map((c) => (
                <ResultRow
                  key={c.id}
                  Icon={User}
                  label={`${c.firstName} ${c.lastName}`}
                  subtitle={[c.company, c.title].filter(Boolean).join(' · ')}
                  onClick={() => goTo(`/contacts/${c.id}`)}
                />
              ))}
            </>
          )}

          {/* Quick actions */}
          {actionResults.length > 0 && (
            <>
              <SectionLabel label={q ? 'Actions' : 'Quick Actions'} />
              {actionResults.map((a) => (
                <ResultRow
                  key={a.type}
                  Icon={a.Icon}
                  label={a.label}
                  badge={!q ? a.shortcut : undefined}
                  onClick={() => act(a.type)}
                />
              ))}
            </>
          )}

          {/* Recently viewed */}
          {!q && recentlyViewed.length > 0 && (
            <>
              <SectionLabel label="Recently Viewed" />
              {recentlyViewed.map((item) => (
                <ResultRow
                  key={`${item.type}-${item.id}`}
                  Icon={Clock}
                  label={item.name}
                  subtitle={item.subtitle}
                  onClick={() => goTo(`/${item.type}s/${item.id}`)}
                />
              ))}
            </>
          )}

          {/* Navigation */}
          {navResults.length > 0 && (
            <>
              <SectionLabel label="Navigate" />
              {navResults.map((cmd) => (
                <ResultRow
                  key={cmd.path}
                  Icon={cmd.Icon}
                  label={cmd.label}
                  onClick={() => goTo(cmd.path)}
                />
              ))}
            </>
          )}

          {q && !hasAny && (
            <p className="px-4 py-8 text-center text-sm text-gray-600">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}
        </div>

        {/* Footer hint */}
        {!q && (
          <div className="px-4 py-2 border-t border-gray-800/60 flex items-center gap-4">
            <span className="text-xs text-gray-700">N · D · T · L for quick actions</span>
            <span className="text-xs text-gray-700 ml-auto">⌘K to open</span>
          </div>
        )}
      </div>
    </div>
  )
}
