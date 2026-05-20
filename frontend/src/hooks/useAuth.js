import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { authLogin, authLogout, authMe, authRegister } from '../services/api'

export function useAuth() {
  const { isLogged, user, token, setAuth, setUser, logout: storeLogout } = useAuthStore()

  // Restore user on load if token present
  useEffect(() => {
    if (token && !user) {
      authMe().then(setUser).catch(() => storeLogout())
    }
  }, [])

  async function login(email, password) {
    const data = await authLogin(email, password)
    setAuth(data.user, data.token)
    return data.user
  }

  async function register(name, email, password) {
    const data = await authRegister(name, email, password)
    setAuth(data.user, data.token)
    return data.user
  }

  async function logout() {
    try { await authLogout() } catch {}
    storeLogout()
  }

  return { isLogged, user, login, register, logout }
}
