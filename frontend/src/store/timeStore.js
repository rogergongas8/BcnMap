import { create } from 'zustand'

export const useTimeStore = create((set) => ({
  isHistorical: false,
  selectedAt: null,
  range: null,
  setRange: (r) => set({ range: r }),
  setHistorical: (at) => set({ isHistorical: true, selectedAt: at }),
  setLive: () => set({ isHistorical: false, selectedAt: null }),
}))
