import { create } from 'zustand'

export const useMapStore = create((set) => ({
  mapInstance:     null,
  isLoaded:        false,
  styleKey:        0,
  mapTheme:        'voyager',
  showBuildings3D: false,
  center:          [2.1734, 41.3851],
  zoom:            13,
  pitch:           0,
  bearing:         0,

  activeLayers:  [],
  trafficMode:   'flux',
  userLocation:  null,

  setMapInstance:  (map)     => set({ mapInstance: map }),
  setLoaded:       (val)     => set({ isLoaded: val }),
  bumpStyleKey:    ()        => set(s => ({ styleKey: s.styleKey + 1 })),
  setMapTheme:     (theme)   => set({ mapTheme: theme, isLoaded: false }),
  toggleLayer:     (id)      => set(s => ({
    activeLayers: s.activeLayers.includes(id)
      ? s.activeLayers.filter(l => l !== id)
      : [...s.activeLayers, id],
  })),
  setTrafficMode:  (mode)    => set({ trafficMode: mode }),
  setUserLocation: (pos)     => set({ userLocation: pos }),

  // Sincroniza el store desde eventos reales del mapa (moveend, zoomend, pitchend)
  setCamera: ({ zoom, pitch, bearing, center } = {}) =>
    set((state) => ({
      zoom:    zoom    ?? state.zoom,
      pitch:   pitch   ?? state.pitch,
      bearing: bearing ?? state.bearing,
      center:  center  ?? state.center,
    })),

  flyTo: ({ lat, lng, zoom = 15, pitch } = {}) =>
    set((state) => {
      const currentPitch = state.mapInstance?.getPitch() ?? state.pitch
      state.mapInstance?.flyTo({
        center:   [lng, lat],
        zoom,
        pitch:    pitch ?? currentPitch,
        duration: 1800,
      })
      return {}
    }),

  // Lee el pitch real del mapa, no el valor potencialmente obsoleto del store
  togglePitch: () =>
    set((state) => {
      const currentPitch = state.mapInstance?.getPitch() ?? state.pitch
      const newPitch = currentPitch > 10 ? 0 : 52
      state.mapInstance?.easeTo({ pitch: newPitch, duration: 800 })
      return { pitch: newPitch }
    }),

  toggleBuildings: () => set(state => ({ showBuildings3D: !state.showBuildings3D })),

  rotateBearing: (delta) =>
    set((state) => {
      const newBearing = (state.bearing + delta + 360) % 360
      state.mapInstance?.easeTo({ bearing: newBearing, duration: 400 })
      return { bearing: newBearing }
    }),

  adjustPitch: (delta) =>
    set((state) => {
      const newPitch = Math.max(0, Math.min(65, state.pitch + delta))
      state.mapInstance?.easeTo({ pitch: newPitch, duration: 400 })
      return { pitch: newPitch }
    }),

  // Ajusta el padding del mapa para que la ruta/contenido no quede tapado por paneles laterales
  setMapPadding: (padding) =>
    set((state) => {
      state.mapInstance?.easeTo({ padding, duration: 280 })
      return {}
    }),
}))
