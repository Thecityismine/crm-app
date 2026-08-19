import { useMemo, useState } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, format, isSameMonth, isToday,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { localDateOnly } from '@/lib/dates'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** A Date → the 'YYYY-MM-DD' key memories are stored under, in local time. */
const dayKey = (d) => format(d, 'yyyy-MM-dd')

/**
 * Month grid over the memories the page has already filtered.
 *
 * Days are matched by comparing 'YYYY-MM-DD' strings rather than by date math:
 * a memory's date is a stored calendar day and a cell is a rendered calendar
 * day, so string equality is both exact and immune to the timezone drift that
 * comparing parsed instants invites.
 */
export default function MemoryCalendar({ memories, selectedDay, onSelectDay }) {
  const [cursor, setCursor] = useState(() => {
    // Open on the most recent month that actually holds something, so the grid
    // isn't empty just because nothing happened this month.
    const newest = memories.find((m) => m.date)?.date
    return newest ? localDateOnly(newest) || new Date() : new Date()
  })

  const byDay = useMemo(() => {
    const map = new Map()
    for (const m of memories) {
      if (!m.date) continue
      const key = String(m.date).slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(m)
    }
    return map
  }, [memories])

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor))
    const end = endOfWeek(endOfMonth(cursor))
    return eachDayOfInterval({ start, end })
  }, [cursor])

  const monthCount = useMemo(
    () => days.filter((d) => isSameMonth(d, cursor))
      .reduce((sum, d) => sum + (byDay.get(dayKey(d))?.length || 0), 0),
    [days, cursor, byDay]
  )

  return (
    <div className="card p-4">
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">{format(cursor, 'MMMM yyyy')}</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            {monthCount === 0 ? 'Nothing this month' : `${monthCount} ${monthCount === 1 ? 'moment' : 'moments'}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor((c) => subMonths(c, 1))}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-gray-600 uppercase tracking-widest py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = dayKey(day)
          const dayMemories = byDay.get(key) || []
          const inMonth = isSameMonth(day, cursor)
          const selected = selectedDay === key
          const has = dayMemories.length > 0

          return (
            <button
              key={key}
              type="button"
              disabled={!has}
              onClick={() => onSelectDay(selected ? null : key)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-1 transition-colors relative ${
                selected ? 'bg-brand-500 text-white'
                  : has ? 'bg-gray-800 hover:bg-gray-700 cursor-pointer'
                  : 'cursor-default'
              } ${inMonth ? '' : 'opacity-30'}`}
            >
              <span className={`text-sm leading-none ${
                selected ? 'text-white font-semibold'
                  : has ? 'text-gray-100 font-medium'
                  : 'text-gray-600'
              }`}>
                {format(day, 'd')}
              </span>

              {/* One dot per moment, to three; more than that becomes a count. */}
              {has && (
                <span className="flex items-center gap-0.5 h-1.5">
                  {dayMemories.length <= 3 ? (
                    dayMemories.map((m) => (
                      <span
                        key={m.id}
                        className={`w-1.5 h-1.5 rounded-full ${
                          selected ? 'bg-white'
                            : m.kind === 'client' ? 'bg-blue-400'
                            : 'bg-violet-400'
                        }`}
                      />
                    ))
                  ) : (
                    <span className={`text-[9px] font-semibold leading-none ${selected ? 'text-white' : 'text-violet-400'}`}>
                      {dayMemories.length}
                    </span>
                  )}
                </span>
              )}

              {isToday(day) && !selected && (
                <span className="absolute inset-0 rounded-lg ring-1 ring-brand-500/60 pointer-events-none" />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-800">
        <span className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />Personal
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />Client
        </span>
        <span className="ml-auto text-[11px] text-gray-700">Pick a day to see its moments</span>
      </div>
    </div>
  )
}
