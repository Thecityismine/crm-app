import { useNavigate, useLocation } from 'react-router-dom'
import { Compass, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Compass size={36} className="text-gray-700 mb-4" />
      <h1 className="text-2xl font-semibold text-gray-100">Page not found</h1>
      <p className="text-sm text-gray-500 mt-1.5 max-w-sm">
        We couldn&rsquo;t find anything at{' '}
        <span className="text-gray-400 font-mono text-xs bg-gray-800 px-1.5 py-0.5 rounded">
          {pathname}
        </span>
      </p>
      <div className="flex items-center gap-2 mt-6">
        <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-1.5 text-sm">
          <ArrowLeft size={14} /> Go back
        </button>
        <button onClick={() => navigate('/')} className="btn-primary text-sm">
          Dashboard
        </button>
      </div>
    </div>
  )
}
