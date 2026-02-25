import { Clock } from 'lucide-react'

export default function ContactTimeline({ contact }) {
  const lastContact = contact.lastCommunication
    ? new Date(contact.lastCommunication).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Activity</h3>
      {lastContact ? (
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Clock size={13} className="text-gray-500" />
          </div>
          <div>
            <p className="text-sm text-gray-300">Last communication</p>
            <p className="text-xs text-gray-500 mt-0.5">{lastContact}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No activity recorded yet.</p>
      )}
    </div>
  )
}
