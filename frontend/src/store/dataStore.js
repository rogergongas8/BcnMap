import { create } from 'zustand'

export const useDataStore = create((set) => ({
  traffic: [],
  bicing: [],
  bus: [],
  metro: [],
  metroLines: [],
  events: [],
  disruptions: [],
  weather: null,
  forecast: null,
  airQuality: null,
  lastUpdated: null,

  setTraffic:      (data) => set({ traffic: data, lastUpdated: new Date() }),
  setBicing:       (data) => set({ bicing: data }),
  setBus:          (data) => set({ bus: data }),
  setMetro:        (data) => set({ metro: data }),
  setMetroLines:   (data) => set({ metroLines: data }),
  setEvents:       (data) => set({ events: data }),
  setDisruptions:  (data) => set({ disruptions: data }),
  setWeather:      (data) => set({ weather: data }),
  setForecast:     (data) => set({ forecast: data }),
  setAirQuality:   (data) => set({ airQuality: data }),
}))
