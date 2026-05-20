import { create } from 'zustand'

const TOKEN_KEY = 'bcn_token'

export const useAuthStore = create((set) => ({
  user:     null,
  token:    localStorage.getItem(TOKEN_KEY) ?? null,
  isLogged: !!localStorage.getItem(TOKEN_KEY),

  setAuth: (user, token) => {
    localStorage.setItem(TOKEN_KEY, token)
    set({ user, token, isLogged: true })
  },
  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ user: null, token: null, isLogged: false })
  },
}))
