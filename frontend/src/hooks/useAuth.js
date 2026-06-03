import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { authLogin, authLogout, authMe, authRegister, getPreferences, updatePreferences } from '../services/api'

export function useAuth() {
  const { isLogged, user, token, setAuth, setUser, setPreferences, logout: storeLogout } = useAuthStore()

  useEffect(() => {
    if (token && !user) {
      authMe()
        .then(u => { setUser(u); return getPreferences() })
        .then(setPreferences)
        .catch(() => storeLogout())
    }
  }, [])

  async function login(email, password) {
    const data = await authLogin(email, password)
    setAuth(data.user, data.token)
    const prefs = await getPreferences().catch(() => null)
    if (prefs) setPreferences(prefs)
    return data.user
  }

  async function register(name, email, password) {
    const data = await authRegister(name, email, password)
    setAuth(data.user, data.token)
    const prefs = await getPreferences().catch(() => null)
    if (prefs) setPreferences(prefs)
    return data.user
  }

  async function logout() {
    try { await authLogout() } catch {}
    storeLogout()
  }

  async function savePreferences(prefs) {
    const updated = await updatePreferences(prefs)
    setPreferences(updated)
    return updated
  }

  return { isLogged, user, login, register, logout, savePreferences }
}
