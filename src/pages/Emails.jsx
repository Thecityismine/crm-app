import { Mail } from 'lucide-react'

export default function Emails() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-100">Emails</h1>
      <p className="text-gray-500 text-sm mt-0.5">Unified inbox and templates</p>

      <div className="card flex flex-col items-center py-20 text-center mt-6">
        <Mail size={32} className="text-gray-700 mb-3" />
        <p className="text-sm text-gray-400 font-medium">Email isn&rsquo;t connected yet</p>
        <p className="text-xs text-gray-600 mt-1.5 max-w-xs">
          Once a mailbox is linked, threads and templates will show up here and
          attach to the matching contact automatically.
        </p>
      </div>
    </div>
  )
}
