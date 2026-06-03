import { create } from 'zustand'

const TOKEN_KEY = 'bcn_token'

export const useAuthStore = create((set) => ({
  user:        null,
  token:       localStorage.getItem(TOKEN_KEY) ?? null,
  isLogged:    !!localStorage.getItem(TOKEN_KEY),
  preferences: null,

  setAuth: (user, token, preferences = null) => {
    localStorage.setItem(TOKEN_KEY, token)
    set({ user, token, isLogged: true, preferences })
  },
  setUser:        (user)  => set({ user }),
  setPreferences: (prefs) => set({ preferences: prefs }),
  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ user: null, token: null, isLogged: false, preferences: null })
  },
}))
