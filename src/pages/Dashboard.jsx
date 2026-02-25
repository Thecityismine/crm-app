import { useNavigate } from 'react-router-dom'
import { useContacts } from '@/hooks/useContacts'
import Avatar from '@/components/ui/Avatar'
import { Cake, Users } from 'lucide-react'

// Compute upcoming birthdays within the next N days
const getUpcomingBirthdays = (contacts, daysAhead = 30) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return contacts
    .map((c) => {
      let nextBday = null

      // Prefer pre-computed nextBirthday from Notion import
      if (c.nextBirthday) {
        nextBday = new Date(c.nextBirthday + 'T12:00:00')
      } else if (c.birthdate) {
        // Compute from birthdate: find next occurrence this year or next
        const birth = new Date(c.birthdate + 'T12:00:00')
        if (!isNaN(birth.getTime())) {
          nextBday = new Date(birth)
          nextBday.setFullYear(today.getFullYear())
          if (nextBday < today) nextBday.setFullYear(today.getFullYear() + 1)
        }
      }

      if (!nextBday || isNaN(nextBday.getTime())) return null
      const daysUntil = Math.round((nextBday - today) / (1000 * 60 * 60 * 24))
      if (daysUntil < 0 || daysUntil > daysAhead) return null
      return { ...c, nextBday, daysUntil }
    })
    .filter(Boolean)
    .sort((a, b) => a.daysUntil - b.daysUntil)
}

function BirthdayCard({ contact }) {
  const navigate = useNavigate()
  const label =
    contact.daysUntil === 0 ? '🎂 Today!' :
    contact.daysUntil === 1 ? 'Tomorrow' :
    `In ${contact.daysUntil} days`

  const isUrgent = contact.daysUntil <= 3

  return (
    <div
      className="flex items-center gap-3 py-3 cursor-pointer hover:bg-gray-800/50 px-3 -mx-3 rounded-lg transition-colors"
      onClick={() => navigate(`/contacts/${contact.id}`)}
    >
      <Avatar firstName={contact.firstName} lastName={contact.lastName} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">
          {contact.firstName} {contact.lastName}
        </p>
        {contact.company && (
          <p className="text-xs text-gray-500 truncate">{contact.company}</p>
        )}
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ${isUrgent ? 'text-amber-400' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  )
}

export default function Dashboard() {
  const { contacts, loading } = useContacts()
  const upcoming = getUpcomingBirthdays(contacts, 30)

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-100 mb-1">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-6">
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Total Contacts</p>
          <p className="text-2xl font-bold text-gray-100">{loading ? '—' : contacts.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Upcoming Birthdays</p>
          <p className="text-2xl font-bold text-gray-100">{loading ? '—' : upcoming.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Overdue Follow-ups</p>
          <p className="text-2xl font-bold text-gray-100">
            {loading ? '—' : contacts.filter((c) => c.nextFollowUp && new Date(c.nextFollowUp) < new Date()).length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Follow-ups Scheduled</p>
          <p className="text-2xl font-bold text-gray-100">
            {loading ? '—' : contacts.filter((c) => c.nextFollowUp && new Date(c.nextFollowUp) >= new Date()).length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming Birthdays */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cake size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-gray-300">Upcoming Birthdays</h2>
            <span className="ml-auto text-xs text-gray-600">Next 30 days</span>
          </div>

          {loading ? (
            <p className="text-sm text-gray-600">Loading...</p>
          ) : upcoming.length > 0 ? (
            <div className="divide-y divide-gray-800/50">
              {upcoming.map((c) => (
                <BirthdayCard key={c.id} contact={c} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <Cake size={28} className="text-gray-700 mb-2" />
              <p className="text-sm text-gray-500">No birthdays in the next 30 days</p>
            </div>
          )}
        </div>

        {/* Overdue follow-ups */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-red-400" />
            <h2 className="text-sm font-semibold text-gray-300">Overdue Follow-ups</h2>
          </div>
          {loading ? (
            <p className="text-sm text-gray-600">Loading...</p>
          ) : (() => {
            const overdue = contacts
              .filter((c) => c.nextFollowUp && new Date(c.nextFollowUp) < new Date())
              .sort((a, b) => new Date(a.nextFollowUp) - new Date(b.nextFollowUp))
              .slice(0, 8)
            return overdue.length > 0 ? (
              <div className="divide-y divide-gray-800/50">
                {overdue.map((c) => {
                  const days = Math.round((new Date() - new Date(c.nextFollowUp)) / (1000 * 60 * 60 * 24))
                  return (
                    <OverdueRow key={c.id} contact={c} daysOverdue={days} />
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <Users size={28} className="text-gray-700 mb-2" />
                <p className="text-sm text-gray-500">All follow-ups are on track</p>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

function OverdueRow({ contact, daysOverdue }) {
  const navigate = useNavigate()
  return (
    <div
      className="flex items-center gap-3 py-3 cursor-pointer hover:bg-gray-800/50 px-3 -mx-3 rounded-lg transition-colors"
      onClick={() => navigate(`/contacts/${contact.id}`)}
    >
      <Avatar firstName={contact.firstName} lastName={contact.lastName} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">
          {contact.firstName} {contact.lastName}
        </p>
        {contact.company && (
          <p className="text-xs text-gray-500 truncate">{contact.company}</p>
        )}
      </div>
      <span className="text-xs font-medium text-red-400 whitespace-nowrap">
        {daysOverdue === 0 ? 'Today' : `${daysOverdue}d overdue`}
      </span>
    </div>
  )
}
