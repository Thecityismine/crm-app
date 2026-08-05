import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import FilterSheet from './FilterSheet'
import {
  activeChips, countActiveFilters, emptyFilters, removeChip, toggleValue,
} from '@/lib/filters'

// Quick chips are a shortcut, not the filter system. Anything past this lives
// behind "More filters" so the page can grow categories without the bar
// turning back into a horizontal scroller.
const QUICK_CHIP_LIMIT = 4

/**
 * Filter bar shared by Contacts and Companies.
 *
 * Desktop: a few common categories inline + "More filters".
 * Mobile:  no category list at all — just a "Filters" button that opens the
 *          sheet. Only the *selected* values appear as chips, and that row is
 *          the one thing allowed to scroll sideways, since it stays short.
 */
export default function FilterControls({
  facets,
  value,
  onChange,
  quickFacetKey,
  totalCount,
  resultCount,
  countFor,
  noun = 'results',
  title = 'Filters',
  sortControl,
  viewControl,
}) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const quickFacet = facets.find((f) => f.key === quickFacetKey)
  const quickOptions = (quickFacet?.options || []).slice(0, QUICK_CHIP_LIMIT)
  const quickSelected = value[quickFacetKey] || []

  const chips = activeChips(facets, value)
  const activeCount = countActiveFilters(value)

  const chipClass = (active) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
      active
        ? 'bg-blue-500/15 text-blue-300 border-blue-500/25'
        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800 border-transparent'
    }`

  return (
    <>
      {/* Quick categories — desktop only */}
      {quickFacet && (
        <div className="hidden sm:flex items-center gap-1 mb-3 flex-wrap">
          <button
            type="button"
            onClick={() => onChange({ ...value, [quickFacetKey]: [] })}
            className={chipClass(quickSelected.length === 0)}
          >
            All
            <span className={`ml-1.5 ${quickSelected.length === 0 ? 'text-blue-400' : 'text-gray-600'}`}>
              {totalCount}
            </span>
          </button>

          {quickOptions.map((o) => {
            const active = quickSelected.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(toggleValue(value, quickFacetKey, o.value))}
                className={chipClass(active)}
              >
                {o.label}
                <span className={`ml-1.5 ${active ? 'text-blue-400' : 'text-gray-600'}`}>{o.count}</span>
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors flex items-center gap-1.5"
          >
            <SlidersHorizontal size={12} />
            More filters
            {activeCount > 0 && (
              <span className="ml-0.5 px-1.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Filters button (phones) + sort + view toggle */}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="sm:hidden btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
        >
          <SlidersHorizontal size={13} />
          Filters
          {activeCount > 0 && (
            <span className="px-1.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">
              {activeCount}
            </span>
          )}
        </button>
        {sortControl}
        {viewControl && <div className="ml-auto flex items-center gap-1">{viewControl}</div>}
      </div>

      {/* Applied values. Short by nature, so sideways scroll is fine here. */}
      {chips.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex gap-1.5 overflow-x-auto flex-1 min-w-0 pb-0.5">
            {chips.map((chip) => (
              <button
                key={`${chip.facetKey}:${chip.value}`}
                type="button"
                onClick={() => onChange(removeChip(value, chip.facetKey, chip.value))}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap bg-blue-500/15 text-blue-300 border border-blue-500/25 hover:bg-blue-500/25 transition-colors"
              >
                {chip.label}
                <X size={11} className="opacity-70" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onChange(emptyFilters(facets))}
            className="text-xs text-gray-500 hover:text-gray-300 whitespace-nowrap transition-colors flex-shrink-0"
          >
            Clear all
          </button>
        </div>
      )}

      <p className="text-xs text-gray-600 mb-3">
        {resultCount} {resultCount === 1 ? noun.replace(/s$/, '') : noun}
      </p>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        facets={facets}
        value={value}
        onApply={onChange}
        countFor={countFor}
        noun={noun}
        title={title}
      />
    </>
  )
}
