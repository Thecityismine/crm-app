import { useState, useEffect, useMemo } from 'react'
import { useContactStore } from '@/store/contactStore'
import { getDeals } from '@/lib/firebase/deals'
import { getTasks } from '@/lib/firebase/tasks'
import { getRecentActivities } from '@/lib/firebase/activities'
import { getHealthScore } from '@/lib/healthScore'
import { Download, TrendingUp } from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtCompact = (n) => {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

// ─── Config ──────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']

const STAGE_COLORS = {
  Lead:        'bg-gray-500',
  Qualified:   'bg-blue-500',
  Proposal:    'bg-yellow-500',
  Negotiation: 'bg-orange-500',
  Won:         'bg-emerald-500',
  Lost:        'bg-red-500/60',
}

const HEALTH_CONFIG = [
  { key: 'active',   label: 'On Track',    color: 'bg-green-500',  badge: 'bg-green-500/15 text-green-400' },
  { key: 'due_soon', label: 'Due Soon',    color: 'bg-yellow-500', badge: 'bg-yellow-500/15 text-yellow-400' },
  { key: 'overdue',  label: 'Overdue',     color: 'bg-orange-500', badge: 'bg-orange-500/15 text-orange-400' },
  { key: 'cold',     label: 'Cold',        color: 'bg-red-500',    badge: 'bg-red-500/15 text-red-400' },
  { key: 'unknown',  label: 'No Activity', color: 'bg-gray-600',   badge: 'bg-gray-700 text-gray-500' },
]

const PRIORITY_CONFIG = [
  { key: 'urgent', label: 'Urgent', color: 'bg-red-500',     badge: 'bg-red-500/15 text-red-400' },
  { key: 'high',   label: 'High',   color: 'bg-orange-500',  badge: 'bg-orange-500/15 text-orange-400' },
  { key: 'medium', label: 'Medium', color: 'bg-yellow-500',  badge: 'bg-yellow-500/15 text-yellow-400' },
  { key: 'low',    label: 'Low',    color: 'bg-blue-500/60', badge: 'bg-blue-500/15 text-blue-400' },
]

// Full class strings for Tailwind JIT
const ACTIVITY_COLORS = {
  email:    'bg-blue-500',
  call:     'bg-green-500',
  meeting:  'bg-violet-500',
  note:     'bg-amber-500',
  task:     'bg-orange-500',
  document: 'bg-cyan-500',
  sms:      'bg-pink-500',
  other:    'bg-gray-500',
}
const ACTIVITY_LABELS = {
  email: 'Email', call: 'Call', meeting: 'Meeting', note: 'Note',
  task: 'Task', document: 'Document', sms: 'SMS', other: 'Other',
}

const DATE_RANGES = [
  { label: '7d',      days: 7 },
  { label: '30d',     days: 30 },
  { label: '90d',     days: 90 },
  { label: 'All time', days: null },
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'text-gray-100' }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color} leading-none`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

function BarRow({ label, count, total, value, color, badge }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 flex-shrink-0 flex items-center justify-between gap-1">
        <span className="text-xs text-gray-400 truncate">{label}</span>
        {badge && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${badge}`}>{count}</span>
        )}
      </div>
      <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-20 text-right flex-shrink-0">
        <span className="text-xs text-gray-400">
          {count} <span className="text-gray-600">({pct}%)</span>
        </span>
      </div>
      {value != null && (
        <div className="w-16 text-right flex-shrink-0">
          <span className="text-xs text-gray-500">{fmtCompact(value)}</span>
        </div>
      )}
    </div>
  )
}

function CardHeader({ title, sub }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-gray-300">{title}</h2>
      {sub && <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{sub}</span>}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Reports() {
  const { contacts } = useContactStore()
  const [deals,      setDeals]      = useState([])
  const [tasks,      setTasks]      = useState([])
  const [activities, setActivities] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [daysBack,   setDaysBack]   = useState(null) // null = All time
  const [showAllRel, setShowAllRel] = useState(false)

  useEffect(() => {
    Promise.all([
      getDeals().catch(() => []),
      getTasks().catch(() => []),
      getRecentActivities(500).catch(() => []),
    ]).then(([d, t, a]) => { setDeals(d); setTasks(t); setActivities(a) })
      .finally(() => setLoading(false))
  }, [])

  // ── Date range start ───────────────────────────────────────────────────────
  const rangeStart = useMemo(() => {
    if (!daysBack) return null
    const d = new Date()
    d.setDate(d.getDate() - daysBack)
    d.setHours(0, 0, 0, 0)
    return d
  }, [daysBack])

  const periodLabel = daysBack ? `Last ${daysBack}d` : 'All time'

  // ── Relationship Health (current snapshot) ─────────────────────────────────
  const healthBuckets = useMemo(() => {
    const counts = { active: 0, due_soon: 0, overdue: 0, cold: 0, unknown: 0 }
    contacts.forEach((c) => {
      const { score } = getHealthScore(c)
      counts[score] = (counts[score] || 0) + 1
    })
    return counts
  }, [contacts])

  // ── Pipeline by Stage (current snapshot) ──────────────────────────────────
  const stageStats = useMemo(() =>
    PIPELINE_STAGES.map((stage) => {
      const sd = deals.filter((d) => d.stage === stage)
      return { stage, count: sd.length, value: sd.reduce((s, d) => s + (Number(d.value) || 0), 0) }
    }), [deals])

  const activeDeals         = deals.filter((d) => !['Won', 'Lost'].includes(d.stage))
  const activePipelineValue = activeDeals.reduce((s, d) => s + (Number(d.value) || 0), 0)
  const maxStageCount       = Math.max(...stageStats.map((s) => s.count), 1)

  // ── Won vs Lost (date-filtered) ────────────────────────────────────────────
  const rangedDeals = useMemo(() => {
    if (!rangeStart) return deals
    return deals.filter((d) => {
      const ds = d.updatedAt || d.createdAt
      return ds && new Date(ds) >= rangeStart
    })
  }, [deals, rangeStart])

  const rangedWon   = rangedDeals.filter((d) => d.stage === 'Won')
  const rangedLost  = rangedDeals.filter((d) => d.stage === 'Lost')
  const wonValue    = rangedWon.reduce((s, d)  => s + (Number(d.value) || 0), 0)
  const lostValue   = rangedLost.reduce((s, d) => s + (Number(d.value) || 0), 0)
  const closedCount = rangedWon.length + rangedLost.length
  const winRate     = closedCount > 0 ? Math.round((rangedWon.length / closedCount) * 100) : null

  // ── Pipeline Velocity (all Won deals) ─────────────────────────────────────
  const avgVelocityDays = useMemo(() => {
    const wonWithDates = deals.filter((d) => d.stage === 'Won' && d.createdAt)
    if (!wonWithDates.length) return null
    const total = wonWithDates.reduce((sum, d) => {
      const from = new Date(d.createdAt)
      const to   = d.updatedAt ? new Date(d.updatedAt) : new Date()
      return sum + Math.max(0, (to - from) / 86400000)
    }, 0)
    return Math.round(total / wonWithDates.length)
  }, [deals])

  // ── Activity by Type (date-filtered) ──────────────────────────────────────
  const { activityRows, activityTotal } = useMemo(() => {
    const ranged = rangeStart
      ? activities.filter((a) => {
          const d = a.occurredAt || a.createdAt
          return d && new Date(d) >= rangeStart
        })
      : activities
    const counts = {}
    ranged.forEach((a) => { const t = a.type || 'other'; counts[t] = (counts[t] || 0) + 1 })
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1])
    return { activityRows: rows, activityTotal: ranged.length }
  }, [activities, rangeStart])

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const openTasks      = tasks.filter((t) => t.status !== 'completed')
  const completedTasks = tasks.filter((t) => t.status === 'completed')
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0

  const priorityCounts = useMemo(() => {
    const counts = { urgent: 0, high: 0, medium: 0, low: 0 }
    openTasks.forEach((t) => { if (counts[t.priority] !== undefined) counts[t.priority]++ })
    return counts
  }, [openTasks])

  // ── Contacts by Relationship ───────────────────────────────────────────────
  const allRelCounts = useMemo(() => {
    const counts = {}
    contacts.forEach((c) => { if (c.relationship) counts[c.relationship] = (counts[c.relationship] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [contacts])

  const visibleRelCounts = showAllRel ? allRelCounts : allRelCounts.slice(0, 6)
  const hiddenRelCount   = allRelCounts.length - 6
  const maxRelCount      = Math.max(...allRelCounts.map(([, n]) => n), 1)

  // ── CSV Export ────────────────────────────────────────────────────────────
  function exportCSV() {
    const section = (title) => [[title], []]
    const rows = [
      ['CRM Report', `Generated ${new Date().toLocaleDateString()}`],
      ['Period', periodLabel],
      [],
      ...section('RELATIONSHIP HEALTH'),
      ['Status', 'Count', 'Percent'],
      ...HEALTH_CONFIG.map(({ key, label }) => [
        label,
        healthBuckets[key] || 0,
        contacts.length ? Math.round(((healthBuckets[key] || 0) / contacts.length) * 100) + '%' : '0%',
      ]),
      [],
      ...section('PIPELINE BY STAGE'),
      ['Stage', 'Deals', 'Value ($)'],
      ...stageStats.map(({ stage, count, value }) => [stage, count, value]),
      [],
      ...section(`WON VS LOST (${periodLabel})`),
      ['Won',           rangedWon.length,  wonValue],
      ['Lost',          rangedLost.length, lostValue],
      ['Win Rate',      winRate !== null ? winRate + '%' : 'N/A'],
      ['Avg Days to Close', avgVelocityDays ?? 'N/A'],
      [],
      ...section('TASKS'),
      ['Completed',       completedTasks.length],
      ['Open',            openTasks.length],
      ['Completion Rate', completionRate + '%'],
      [],
      ...section(`ACTIVITY BY TYPE (${periodLabel})`),
      ['Type', 'Count'],
      ...activityRows.map(([type, count]) => [ACTIVITY_LABELS[type] || type, count]),
      [],
      ...section('CONTACTS BY RELATIONSHIP'),
      ['Relationship', 'Count'],
      ...allRelCounts.map(([rel, count]) => [rel, count]),
    ]
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `crm-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-600 text-sm">Loading reports...</div>
  }

  return (
    <div className="max-w-4xl space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">Overview of your relationships, pipeline, and tasks</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range selector */}
          <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg p-0.5 gap-0.5">
            {DATE_RANGES.map(({ label, days }) => (
              <button
                key={label}
                onClick={() => setDaysBack(days)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                  daysBack === days
                    ? 'bg-gray-600 text-gray-100'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={exportCSV}
            className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Contacts" value={contacts.length} />
        <StatCard
          label="Active Pipeline"
          value={fmtCompact(activePipelineValue)}
          sub={`${activeDeals.length} open deal${activeDeals.length !== 1 ? 's' : ''}`}
          color={activePipelineValue > 0 ? 'text-blue-400' : 'text-gray-100'}
        />
        <StatCard
          label={`Won Value · ${periodLabel}`}
          value={fmtCompact(wonValue)}
          sub={`${rangedWon.length} deal${rangedWon.length !== 1 ? 's' : ''} closed`}
          color={wonValue > 0 ? 'text-emerald-400' : 'text-gray-100'}
        />
        <StatCard
          label="Task Completion"
          value={`${completionRate}%`}
          sub={`${completedTasks.length} completed · ${openTasks.length} open`}
          color={completionRate >= 70 ? 'text-emerald-400' : completionRate >= 40 ? 'text-yellow-400' : 'text-gray-100'}
        />
      </div>

      {/* ── Row 1: Health | Pipeline ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="card p-5">
          <CardHeader title="Relationship Health" sub="Current snapshot" />
          {contacts.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">No contacts yet</p>
          ) : (
            <div className="space-y-3">
              {HEALTH_CONFIG.map(({ key, label, color, badge }) => (
                <BarRow key={key} label={label} count={healthBuckets[key] || 0} total={contacts.length} color={color} badge={badge} />
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <CardHeader title="Pipeline by Stage" sub="Current snapshot" />
          {deals.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">No deals yet</p>
          ) : (
            <div className="space-y-3">
              {stageStats.map(({ stage, count, value }) => (
                <BarRow key={stage} label={stage} count={count} total={maxStageCount} value={value} color={STAGE_COLORS[stage]} />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Row 2: Won vs Lost | Activity by Type ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Won vs Lost + Pipeline Velocity */}
        <div className="card p-5">
          <CardHeader title="Won vs Lost" sub={periodLabel} />
          {closedCount === 0 ? (
            <p className="text-sm text-gray-600 text-center py-6">
              {deals.length === 0 ? 'No deals yet' : 'No closed deals in this period'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{rangedWon.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Won</p>
                  {wonValue > 0 && <p className="text-xs text-emerald-500 font-medium mt-1">{fmtCompact(wonValue)}</p>}
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-red-400">{rangedLost.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Lost</p>
                  {lostValue > 0 && <p className="text-xs text-red-400 font-medium mt-1">{fmtCompact(lostValue)}</p>}
                </div>
              </div>
              {winRate !== null && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-500">Win rate</span>
                    <span className="text-gray-300 font-semibold">{winRate}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${winRate}%` }} />
                  </div>
                </div>
              )}
            </>
          )}
          {/* Velocity — always shown if data available */}
          {avgVelocityDays !== null ? (
            <div className={`flex items-center gap-2 text-xs text-gray-500 ${closedCount > 0 ? 'mt-4 pt-4 border-t border-gray-800' : ''}`}>
              <TrendingUp size={13} className="text-blue-400 flex-shrink-0" />
              <span>
                Pipeline velocity: avg <span className="text-blue-400 font-semibold">{avgVelocityDays} days</span> to close
              </span>
            </div>
          ) : (
            <p className="text-xs text-gray-700 text-center mt-4">Pipeline velocity available once deals are won</p>
          )}
        </div>

        {/* Activity by Type */}
        <div className="card p-5">
          <CardHeader title="Activity by Type" sub={periodLabel} />
          {activityRows.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-6">
              {activities.length === 0 ? 'No activities logged yet' : 'No activities in this period'}
            </p>
          ) : (
            <div className="space-y-3">
              {activityRows.map(([type, count]) => (
                <BarRow
                  key={type}
                  label={ACTIVITY_LABELS[type] || type}
                  count={count}
                  total={activityTotal}
                  color={ACTIVITY_COLORS[type] || ACTIVITY_COLORS.other}
                />
              ))}
              <p className="text-xs text-gray-700 pt-1 text-right">{activityTotal} total</p>
            </div>
          )}
        </div>

      </div>

      {/* ── Row 3: Tasks | Relationships ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="card p-5">
          <CardHeader title="Open Tasks by Priority" sub={`${openTasks.length} open`} />
          {openTasks.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">No open tasks — all caught up!</p>
          ) : (
            <div className="space-y-3">
              {PRIORITY_CONFIG.map(({ key, label, color, badge }) => (
                <BarRow key={key} label={label} count={priorityCounts[key] || 0} total={openTasks.length} color={color} badge={badge} />
              ))}
            </div>
          )}
          {tasks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-gray-500">{completedTasks.length} completed · {openTasks.length} open</span>
                <span className="text-gray-400 font-semibold">{completionRate}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${completionRate}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="card p-5">
          <CardHeader title="Contacts by Relationship" sub={`${contacts.length} total`} />
          {allRelCounts.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">No relationship tags set</p>
          ) : (
            <>
              <div className="space-y-3">
                {visibleRelCounts.map(([label, count]) => (
                  <BarRow key={label} label={label} count={count} total={maxRelCount} color="bg-brand-500" />
                ))}
              </div>
              {allRelCounts.length > 6 && (
                <button
                  onClick={() => setShowAllRel((s) => !s)}
                  className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {showAllRel
                    ? 'Show fewer'
                    : `Show ${hiddenRelCount} more relationship type${hiddenRelCount !== 1 ? 's' : ''}`}
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  )
}
