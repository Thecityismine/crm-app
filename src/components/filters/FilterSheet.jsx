import { useEffect, useMemo, useState } from 'react'
import { X, Search, Check } from 'lucide-react'
import { emptyFilters, countActiveFilters, toggleValue } from '@/lib/filters'

// How many options a section shows before collapsing behind "Show all".
const COLLAPSED_LIMIT = 8

function Section({ facet, draft, setDraft, query }) {
  const [expanded, setExpanded] = useState(false)

  if (facet.type === 'select') {
    const options = facet.options || []
    if (!options.length) return null
    return (
      <div className="mb-6">
        <h3 className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase mb-2">
          {facet.label}
        </h3>
        <select
          className="input text-sm"
          value={draft[facet.key] || ''}
          onChange={(e) => setDraft({ ...draft, [facet.key]: e.target.value })}
        >
          <option value="">{facet.placeholder || `Select ${facet.label.toLowerCase()}...`}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}{o.count != null ? ` (${o.count})` : ''}
            </option>
          ))}
        </select>
      </div>
    )
  }

  const q = query.trim().toLowerCase()
  const all = (facet.options || []).filter((o) => !q || o.label.toLowerCase().includes(q))
  if (!all.length) return null

  // A searching user wants to see everything that matched, not a truncated slice.
  const selected = draft[facet.key] || []
  const visible = expanded || q ? all : all.slice(0, COLLAPSED_LIMIT)
  const hidden = all.length - visible.length

  return (
    <div className="mb-6">
      <h3 className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase mb-2">
        {facet.label}
      </h3>
      <div className="space-y-0.5">
        {visible.map((o) => {
          const checked = selected.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setDraft(toggleValue(draft, facet.key, o.value))}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left hover:bg-gray-800/60 transition-colors"
            >
              <span
                className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  checked ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                }`}
              >
                {checked && <Check size={11} className="text-white" strokeWidth={3} />}
              </span>
              <span className={`flex-1 text-sm ${checked ? 'text-gray-100' : 'text-gray-300'}`}>
                {o.label}
              </span>
              {o.count != null && (
                <span className="text-xs text-gray-600 tabular-nums">{o.count}</span>
              )}
            </button>
          )
        })}
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 px-2 py-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Show all {all.length} categories
        </button>
      )}
    </div>
  )
}

/**
 * Filter panel — a bottom sheet on phones, a right-hand drawer from `sm` up.
 *
 * Edits go to a local draft and only reach the page when "Show N" is pressed,
 * so ticking four categories doesn't re-render the list (and re-close the
 * panel) four times. The button label previews the draft's result count.
 */
export default function FilterSheet({
  open,
  onClose,
  facets,
  value,
  onApply,
  countFor,
  noun = 'results',
  title = 'Filters',
}) {
  const [draft, setDraft] = useState(value)
  const [query, setQuery] = useState('')

  // Re-sync whenever the sheet is opened, so a cancelled edit doesn't persist.
  useEffect(() => {
    if (open) {
      setDraft(value)
      setQuery('')
    }
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  const resultCount = useMemo(
    () => (countFor ? countFor(draft) : null),
    [countFor, draft]
  )
  const activeCount = countActiveFilters(draft)

  if (!open) return null

  const searchable = facets.some((f) => (f.options?.length || 0) > COLLAPSED_LIMIT)

  return (
    <div className="fixed inset-0 z-50 flex sm:justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative mt-auto sm:mt-0 w-full sm:w-[380px] sm:h-full bg-gray-900 border-t sm:border-t-0 sm:border-l border-gray-800 rounded-t-2xl sm:rounded-none flex flex-col max-h-[88vh] sm:max-h-none"
      >
        {/* Grab handle — phones only */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-gray-700" />
        </div>

        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-100">{title}</h2>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => setDraft(emptyFilters(facets))}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Close filters"
          >
            <X size={18} />
          </button>
        </div>

        {searchable && (
          <div className="px-4 pt-3 flex-shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="input pl-8 text-sm"
                placeholder="Search categories..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pt-4">
          {facets.map((f) => (
            <Section key={f.key} facet={f} draft={draft} setDraft={setDraft} query={query} />
          ))}
        </div>

        <div className="p-3 border-t border-gray-800 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => { onApply(draft); onClose() }}
            className="btn-primary w-full justify-center"
          >
            {resultCount == null
              ? 'Apply filters'
              : `Show ${resultCount} ${resultCount === 1 ? noun.replace(/s$/, '') : noun}`}
          </button>
        </div>
      </div>
    </div>
  )
}
