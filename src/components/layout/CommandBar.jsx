import { useState, useEffect, useRef } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'

const COMMANDS = [
  { label: 'Go to Dashboard', action: '/', type: 'nav' },
  { label: 'Go to Contacts', action: '/contacts', type: 'nav' },
  { label: 'Go to Pipeline', action: '/pipeline', type: 'nav' },
  { label: 'Go to Deals', action: '/deals', type: 'nav' },
  { label: 'Go to Tasks', action: '/tasks', type: 'nav' },
]

export default function CommandBar() {
  const { closeCommandBar } = useUIStore()
  const [query, setQuery] = useState('')
  const inputRef = useRef()
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
    const handler = (e) => { if (e.key === 'Escape') closeCommandBar() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const filtered = COMMANDS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-24">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-800">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <Search size={16} className="text-gray-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or ask AI anything..."
            className="flex-1 outline-none text-sm bg-transparent text-gray-100 placeholder-gray-500"
          />
          <button onClick={closeCommandBar}><X size={16} className="text-gray-500" /></button>
        </div>
        <div className="py-2 max-h-72 overflow-y-auto">
          {filtered.map((cmd) => (
            <button
              key={cmd.action}
              onClick={() => { navigate(cmd.action); closeCommandBar() }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 flex items-center gap-2"
            >
              {cmd.label}
            </button>
          ))}
          {query && !filtered.length && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">No results found</div>
          )}
        </div>
      </div>
    </div>
  )
}
