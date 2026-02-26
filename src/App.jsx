import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import AppShell from '@/components/layout/AppShell'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Contacts from '@/pages/Contacts'
import ContactDetail from '@/pages/ContactDetail'
import Companies from '@/pages/Companies'
import CompanyDetail from '@/pages/CompanyDetail'
import Deals from '@/pages/Deals'
import DealDetail from '@/pages/DealDetail'
import Pipeline from '@/pages/Pipeline'
import Properties from '@/pages/Properties'
import PropertyDetail from '@/pages/PropertyDetail'
import ContactMap from '@/pages/ContactMap'
import Tasks from '@/pages/Tasks'
import Emails from '@/pages/Emails'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'
import NotFound from '@/pages/NotFound'
import { useEffect } from 'react'
import { auth } from '@/config/firebase'
import { onAuthStateChanged } from 'firebase/auth'

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
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
