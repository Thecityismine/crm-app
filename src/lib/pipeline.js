// Single source of truth for pipeline stages.
//
// Every surface that reasons about deal stages — the Kanban board, the Deals
// table, the Dashboard stats, Reports — must read from here. Hardcoding a
// stage list anywhere else silently breaks the moment a user picks a
// non-default pipeline template in Settings.

import { useSettingsStore, PIPELINE_TEMPLATES } from '@/store/settingsStore'

// Which stage in each template means "won" and which means "lost".
// Positional guessing doesn't work: `development` ends in a single terminal
// stage (Completed) with no lost equivalent.
export const PIPELINE_TERMINALS = {
  default:     { won: 'Won',       lost: 'Lost' },
  leasing:     { won: 'Closed',    lost: 'Lost' },
  acquisition: { won: 'Closed',    lost: 'Dead' },
  development: { won: 'Completed', lost: null },
  lending:     { won: 'Funded',    lost: 'Declined' },
}

/**
 * Resolve a template key into its full stage configuration.
 * Returns { stages, activeStages, won, lost, isActive, isWon, isLost }
 */
export function getPipelineConfig(template) {
  const key = PIPELINE_TEMPLATES[template] ? template : 'default'
  const stages = PIPELINE_TEMPLATES[key]
  const { won, lost } = PIPELINE_TERMINALS[key] || PIPELINE_TERMINALS.default

  const terminals = new Set([won, lost].filter(Boolean))
  const activeStages = stages.filter((s) => !terminals.has(s))
  const activeSet = new Set(activeStages)

  return {
    stages,
    activeStages,
    won,
    lost,
    isActive: (stage) => activeSet.has(stage),
    isWon:    (stage) => stage === won,
    isLost:   (stage) => Boolean(lost) && stage === lost,
  }
}

/** Reactive hook — re-renders when the user switches template in Settings. */
export function usePipelineConfig() {
  const template = useSettingsStore((s) => s.pipelineTemplate)
  return getPipelineConfig(template)
}

// ── Stage colours ────────────────────────────────────────────────────────────
// Keyed by position rather than stage name, so custom templates get sensible
// colours instead of falling through to a default grey. Full class strings so
// Tailwind's JIT compiler can see them.

// Templates can be longer than the active-colour ramp, so the last colour
// repeats rather than running off the end of the array.
function pick(stage, config, { active, won, lost }) {
  if (config.isWon(stage))  return won
  if (config.isLost(stage)) return lost
  const i = config.activeStages.indexOf(stage)
  return i === -1 ? active[0] : active[Math.min(i, active.length - 1)]
}

const BADGE = {
  active: [
    'bg-gray-700 text-gray-300',
    'bg-blue-500/20 text-blue-300',
    'bg-yellow-500/20 text-yellow-300',
    'bg-orange-500/20 text-orange-300',
    'bg-violet-500/20 text-violet-300',
  ],
  won:  'bg-emerald-500/20 text-emerald-300',
  lost: 'bg-red-500/15 text-red-400',
}

// Same palette as BADGE with a matching border, for surfaces that outline the pill.
const BORDERED_BADGE = {
  active: [
    'bg-gray-700 text-gray-300 border-gray-600',
    'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'bg-violet-500/20 text-violet-300 border-violet-500/30',
  ],
  won:  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  lost: 'bg-red-500/15 text-red-400 border-red-500/20',
}

// Border-only accent, for the Kanban column headers.
const ACCENT_BORDER = {
  active: [
    'border-gray-600',
    'border-blue-500/60',
    'border-yellow-500/60',
    'border-orange-500/60',
    'border-violet-500/60',
  ],
  won:  'border-emerald-500/60',
  lost: 'border-red-500/40',
}

const BAR = {
  active: [
    'bg-gray-500',
    'bg-blue-500',
    'bg-yellow-500',
    'bg-orange-500',
    'bg-violet-500',
  ],
  won:  'bg-emerald-500',
  lost: 'bg-red-500/60',
}

/** Tailwind classes for a stage pill/badge. */
export function stageBadgeClass(stage, config) {
  return pick(stage, config, BADGE)
}

/** Stage pill/badge classes including a border colour (expects `border` on the element). */
export function stageBorderBadgeClass(stage, config) {
  return pick(stage, config, BORDERED_BADGE)
}

/** Border colour used as a stage accent (Kanban column headers). */
export function stageAccentBorderClass(stage, config) {
  return pick(stage, config, ACCENT_BORDER)
}

/** Tailwind background class for a stage progress bar. */
export function stageBarClass(stage, config) {
  return pick(stage, config, BAR)
}
