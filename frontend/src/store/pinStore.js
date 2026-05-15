import { create } from 'zustand'

export const usePinStore = create((set) => ({
  pin: null,

  setPin: (pin) => set({ pin }),
  clearPin: () => set({ pin: null }),
}))
