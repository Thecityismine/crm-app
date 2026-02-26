import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '@/store/notificationStore'
import { Bell, Calendar, CheckSquare, Phone, X, CheckCheck } from 'lucide-react'

const TYPE_CONFIG = {
  followup: { icon: Phone,       color: 'text-orange-400', bg: 'bg-orange-500/10' },
  birthday:  { icon: Calendar,   color: 'text-amber-400',  bg: 'bg-amber-500/10'  },
  task:      { icon: CheckSquare, color: 'text-blue-400',  bg: 'bg-blue-500/10'   },
}

export default function NotificationPanel({ onClose }) {
  const { notifications, markRead, setNotifications } = useNotificationStore()
  const navigate = useNavigate()
  const panelRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleClick = (notif) => {
    markRead(notif.id)
    if (notif.contactId) navigate(`/contacts/${notif.contactId}`)
    else if (notif.taskId) navigate('/tasks')
    onClose()
  }

  const markAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })))
  }

  const unread = notifications.filter((n) => !n.isRead).length

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-200">Notifications</h3>
          {unread > 0 && (
            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-medium">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <CheckCheck size={12} /> Mark all read
            </button>
          )}
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* List */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <Bell size={24} className="text-gray-700 mb-2" />
          <p className="text-sm text-gray-500">All caught up!</p>
          <p className="text-xs text-gray-700 mt-1">No overdue items</p>
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-800/50">
          {notifications.map((notif) => {
            const cfg = TYPE_CONFIG[notif.type] || { icon: Bell, color: 'text-gray-400', bg: 'bg-gray-500/10' }
            const Icon = cfg.icon
            return (
              <div
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-800/60 transition-colors ${
                  !notif.isRead ? 'bg-gray-800/25' : ''
                }`}
              >
                <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon size={13} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug truncate ${notif.isRead ? 'text-gray-400' : 'text-gray-100 font-medium'}`}>
                    {notif.title}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">{notif.subtitle}</p>
                </div>
                {!notif.isRead && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
