import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import AppShell from '@/components/layout/AppShell'
import { lazy, useEffect } from 'react'
import { auth } from '@/config/firebase'
import { onAuthStateChanged } from 'firebase/auth'

// Eager: Login is the first paint for signed-out users, and NotFound is small
// enough that a chunk fetch would cost more than it saves.
import Login from '@/pages/Login'
import NotFound from '@/pages/NotFound'

// Lazy: everything behind auth. Each route becomes its own chunk, so the
// initial download no longer carries all 15 pages — notably Leaflet, which
// only Map and Properties need. AppShell renders the Suspense boundary, so
// the sidebar and top bar stay put while a page chunk loads.
const Dashboard      = lazy(() => import('@/pages/Dashboard'))
const Contacts       = lazy(() => import('@/pages/Contacts'))
const ContactDetail  = lazy(() => import('@/pages/ContactDetail'))
const Companies      = lazy(() => import('@/pages/Companies'))
const CompanyDetail  = lazy(() => import('@/pages/CompanyDetail'))
const Deals          = lazy(() => import('@/pages/Deals'))
const DealDetail     = lazy(() => import('@/pages/DealDetail'))
const Pipeline       = lazy(() => import('@/pages/Pipeline'))
const Properties     = lazy(() => import('@/pages/Properties'))
const PropertyDetail = lazy(() => import('@/pages/PropertyDetail'))
const ContactMap     = lazy(() => import('@/pages/ContactMap'))
const Tasks          = lazy(() => import('@/pages/Tasks'))
const Emails         = lazy(() => import('@/pages/Emails'))
const Reports        = lazy(() => import('@/pages/Reports'))
const Settings       = lazy(() => import('@/pages/Settings'))

function PrivateRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })
    return unsub
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><AppShell /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="contacts/:id" element={<ContactDetail />} />
          <Route path="companies" element={<Companies />} />
          <Route path="companies/:id" element={<CompanyDetail />} />
          <Route path="deals" element={<Deals />} />
          <Route path="deals/:id" element={<DealDetail />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="properties" element={<Properties />} />
          <Route path="properties/:id" element={<PropertyDetail />} />
          <Route path="map" element={<ContactMap />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="emails" element={<Emails />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          {/* Catch-all lives inside AppShell so a bad URL keeps its navigation */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
