import { useState, useEffect, useMemo } from 'react'
import { useContactStore } from '@/store/contactStore'
import { getDeals } from '@/lib/firebase/deals'
import { getTasks } from '@/lib/firebase/tasks'
import { getHealthScore } from '@/lib/healthScore'

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n)

const fmtCompact = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

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
      <div className="w-28 flex-shrink-0 flex items-center justify-between">
        <span className="text-xs text-gray-400">{label}</span>
        {badge && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${badge}`}>{count}</span>
        )}
      </div>
      <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
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
  { key: 'active',  label: 'On Track',    color: 'bg-green-500',  badge: 'bg-green-500/15 text-green-400' },
  { key: 'due_soon',label: 'Due Soon',    color: 'bg-yellow-500', badge: 'bg-yellow-500/15 text-yellow-400' },
  { key: 'overdue', label: 'Overdue',     color: 'bg-orange-500', badge: 'bg-orange-500/15 text-orange-400' },
  { key: 'cold',    label: 'Cold',        color: 'bg-red-500',    badge: 'bg-red-500/15 text-red-400' },
  { key: 'unknown', label: 'No Activity', color: 'bg-gray-600',   badge: 'bg-gray-700 text-gray-500' },
]

const PRIORITY_CONFIG = [
  { key: 'urgent', label: 'Urgent', color: 'bg-red-500',    badge: 'bg-red-500/15 text-red-400' },
  { key: 'high',   label: 'High',   color: 'bg-orange-500', badge: 'bg-orange-500/15 text-orange-400' },
  { key: 'medium', label: 'Medium', color: 'bg-yellow-500', badge: 'bg-yellow-500/15 text-yellow-400' },
  { key: 'low',    label: 'Low',    color: 'bg-blue-500/60',badge: 'bg-blue-500/15 text-blue-400' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Reports() {
  const { contacts } = useContactStore()
  const [deals, setDeals] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getDeals(), getTasks()])
      .then(([d, t]) => { setDeals(d); setTasks(t) })
      .catch(console.warn)
      .finally(() => setLoading(false))
  }, [])

  // ── Contact health ──────────────────────────────────────────────────────────
  const healthBuckets = useMemo(() => {
    const counts = { active: 0, due_soon: 0, overdue: 0, cold: 0, unknown: 0 }
    contacts.forEach((c) => {
      const { score } = getHealthScore(c)
      counts[score] = (counts[score] || 0) + 1
    })
    return counts
  }, [contacts])

  // ── Pipeline ────────────────────────────────────────────────────────────────
  const stageStats = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => {
      const stageDeals = deals.filter((d) => d.stage === stage)
      const value = stageDeals.reduce((s, d) => s + (Number(d.value) || 0), 0)
      return { stage, count: stageDeals.length, value }
    })
  }, [deals])

  const activeDeals = deals.filter((d) => !['Won', 'Lost'].includes(d.stage))
  const wonDeals    = deals.filter((d) => d.stage === 'Won')
  const activePipelineValue = activeDeals.reduce((s, d) => s + (Number(d.value) || 0), 0)
  const wonValue            = wonDeals.reduce((s, d) => s + (Number(d.value) || 0), 0)
  const maxStageCount       = Math.max(...stageStats.map((s) => s.count), 1)

  // ── Tasks ───────────────────────────────────────────────────────────────────
  const openTasks      = tasks.filter((t) => t.status !== 'completed')
  const completedTasks = tasks.filter((t) => t.status === 'completed')
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0

  const priorityCounts = useMemo(() => {
    const counts = { urgent: 0, high: 0, medium: 0, low: 0 }
    openTasks.forEach((t) => {
      if (counts[t.priority] !== undefined) counts[t.priority]++
    })
    return counts
  }, [openTasks])

  // ── Relationship breakdown ──────────────────────────────────────────────────
  const relationshipCounts = useMemo(() => {
    const counts = {}
    contacts.forEach((c) => {
      if (c.relationship) counts[c.relationship] = (counts[c.relationship] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [contacts])

  const maxRelCount = Math.max(...relationshipCounts.map(([, n]) => n), 1)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-600 text-sm">
        Loading reports...
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-100">Reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">Overview of your relationships, pipeline, and tasks</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Contacts" value={contacts.length} />
        <StatCard
          label="Active Pipeline"
          value={fmtCompact(activePipelineValue)}
          sub={`${activeDeals.length} deals`}
          color={activePipelineValue > 0 ? 'text-blue-400' : 'text-gray-100'}
        />
        <StatCard
          label="Won Value"
          value={fmtCompact(wonValue)}
          sub={`${wonDeals.length} deals closed`}
          color={wonValue > 0 ? 'text-emerald-400' : 'text-gray-100'}
        />
        <StatCard
          label="Task Completion"
          value={`${completionRate}%`}
          sub={`${completedTasks.length} of ${tasks.length} done`}
          color={completionRate >= 70 ? 'text-emerald-400' : completionRate >= 40 ? 'text-yellow-400' : 'text-gray-100'}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Contact Health */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Relationship Health</h2>
          <div className="space-y-3">
            {HEALTH_CONFIG.map(({ key, label, color, badge }) => (
              <BarRow
                key={key}
                label={label}
                count={healthBuckets[key] || 0}
                total={contacts.length}
                color={color}
                badge={badge}
              />
            ))}
          </div>
          {contacts.length === 0 && (
            <p className="text-sm text-gray-600 text-center py-4">No contacts yet</p>
          )}
        </div>

        {/* Pipeline by Stage */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Pipeline by Stage</h2>
          {deals.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">No deals yet</p>
          ) : (
            <div className="space-y-3">
              {stageStats.map(({ stage, count, value }) => (
                <BarRow
                  key={stage}
                  label={stage}
                  count={count}
                  total={maxStageCount}
                  value={value}
                  color={STAGE_COLORS[stage]}
                />
              ))}
            </div>
          )}
        </div>

        {/* Task Priority Breakdown */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Open Tasks by Priority</h2>
            <span className="text-xs text-gray-600">{openTasks.length} open</span>
          </div>
          {openTasks.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">No open tasks</p>
          ) : (
            <div className="space-y-3">
              {PRIORITY_CONFIG.map(({ key, label, color, badge }) => (
                <BarRow
                  key={key}
                  label={label}
                  count={priorityCounts[key] || 0}
                  total={openTasks.length}
                  color={color}
                  badge={badge}
                />
              ))}
            </div>
          )}
          {tasks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-3">
              <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 flex-shrink-0">{completionRate}% complete</span>
            </div>
          )}
        </div>

        {/* Contacts by Relationship */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Contacts by Relationship</h2>
            <span className="text-xs text-gray-600">{contacts.length} total</span>
          </div>
          {relationshipCounts.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">No relationship tags set</p>
          ) : (
            <div className="space-y-3">
              {relationshipCounts.map(([label, count]) => (
                <BarRow
                  key={label}
                  label={label}
                  count={count}
                  total={maxRelCount}
                  color="bg-brand-500"
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
