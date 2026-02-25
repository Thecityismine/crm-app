import { useAuthStore } from '@/store/authStore'
import { loginWithGoogle, loginWithEmail, logout } from '@/lib/firebase/auth'

export const useAuth = () => {
  const { user, loading } = useAuthStore()
  return { user, loading, loginWithGoogle, loginWithEmail, logout }
}
