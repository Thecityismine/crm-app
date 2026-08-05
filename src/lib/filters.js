// Page-agnostic filtering engine.
//
// A "facet" is one filterable dimension (relationship, industry, location...).
// Pages declare their facets; the shared filter UI renders them and this
// module decides what passes. Keeping the matching here means Contacts and
// Companies can't drift into two subtly different definitions of "active".

/**
 * Facet shape:
 *   key      unique id, also the key in filter state
 *   label    section heading in the panel
 *   type     'multi'  — checkboxes, OR within the facet
 *            'select' — single value from a dropdown
 *   options  [{ value, label, count }]  (multi only)
 *   match    (item, selection) => boolean
 */

/** Selection object with every facet cleared. */
export function emptyFilters(facets) {
  const state = {}
  for (const f of facets) state[f.key] = f.type === 'select' ? '' : []
  return state
}

function facetIsSet(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value)
}

/** How many individual values are selected, for the "Filters 2" badge. */
export function countActiveFilters(state) {
  return Object.values(state || {}).reduce(
    (n, v) => n + (Array.isArray(v) ? v.length : v ? 1 : 0),
    0
  )
}

export function hasActiveFilters(state) {
  return countActiveFilters(state) > 0
}

/** An item passes when every facet with a selection accepts it (AND across facets). */
export function matchesFilters(item, facets, state) {
  for (const f of facets) {
    const selection = state?.[f.key]
    if (!facetIsSet(selection)) continue
    if (!f.match(item, selection)) return false
  }
  return true
}

/** Flatten the selection into removable chips for the active-filter row. */
export function activeChips(facets, state) {
  const chips = []
  for (const f of facets) {
    const selection = state?.[f.key]
    if (!facetIsSet(selection)) continue
    if (Array.isArray(selection)) {
      for (const value of selection) {
        const opt = f.options?.find((o) => o.value === value)
        chips.push({ facetKey: f.key, value, label: opt?.label ?? value })
      }
    } else {
      chips.push({ facetKey: f.key, value: selection, label: selection })
    }
  }
  return chips
}

/** Remove one chip's value, leaving the rest of the selection intact. */
export function removeChip(state, facetKey, value) {
  const current = state[facetKey]
  return {
    ...state,
    [facetKey]: Array.isArray(current) ? current.filter((v) => v !== value) : '',
  }
}

/** Toggle one value inside a 'multi' facet. */
export function toggleValue(state, facetKey, value) {
  const current = state[facetKey] || []
  return {
    ...state,
    [facetKey]: current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value],
  }
}

// ── Option builders ──────────────────────────────────────────────────────────

/**
 * Tally a field across items in a single pass and return options ordered by
 * `pinned` first, then by count descending. Values with no matches are
 * dropped — a filter that returns nothing is a dead end.
 */
export function optionsFromField(items, field, { pinned = [], unassignedValue } = {}) {
  const counts = new Map()
  let missing = 0
  for (const item of items) {
    const v = item[field]
    if (v) counts.set(v, (counts.get(v) || 0) + 1)
    else missing++
  }

  const pinnedOpts = pinned
    .filter((p) => counts.has(p))
    .map((p) => ({ value: p, label: p, count: counts.get(p) }))

  const rest = [...counts.entries()]
    .filter(([v]) => !pinned.includes(v))
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  const options = [...pinnedOpts, ...rest]
  if (unassignedValue && missing > 0) {
    options.push({ value: unassignedValue, label: 'Unassigned', count: missing })
  }
  return options
}

/** Distinct non-empty values of a field, most common first — for 'select' facets. */
export function valuesFromField(items, field) {
  const counts = new Map()
  for (const item of items) {
    const v = item[field]
    if (v) counts.set(v, (counts.get(v) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, label: value, count }))
}
