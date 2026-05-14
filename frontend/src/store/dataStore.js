import { create } from 'zustand'

export const useDataStore = create((set) => ({
  traffic: [],
  bicing: [],
  bus: [],
  metro: [],
  metroLines: [],
  weather: null,
  airQuality: null,
  lastUpdated: null,

  setTraffic:    (data) => set({ traffic: data, lastUpdated: new Date() }),
  setBicing:     (data) => set({ bicing: data }),
  setBus:        (data) => set({ bus: data }),
  setMetro:      (data) => set({ metro: data }),
  setMetroLines: (data) => set({ metroLines: data }),
  setWeather:    (data) => set({ weather: data }),
  setAirQuality: (data) => set({ airQuality: data }),
}))
