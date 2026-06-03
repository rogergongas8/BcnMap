import { create } from 'zustand'

// Single source of truth for the side drawer.
// view: 'nearby' (categories + list) | 'place' (single place detail) | null (closed)
export const useDrawerStore = create((set) => ({
  view: null,
  place: null,
  focusedEventKey: null,
  eventsCategory: null,

  openNearby:         () => set({ view: 'nearby',       place: null, focusedEventKey: null, eventsCategory: null }),
  openSaved:          () => set({ view: 'saved',        place: null, focusedEventKey: null, eventsCategory: null }),
  openEvents:         (opts = {}) => set({ view: 'events', place: null, focusedEventKey: null, eventsCategory: opts.category ?? null }),
  openDisruptions:    () => set({ view: 'disruptions',  place: null, focusedEventKey: null, eventsCategory: null }),
  openEventFocused:   (key) => set({ view: 'events', place: null, focusedEventKey: key }),
  clearEventFocus:    () => set({ focusedEventKey: null }),
  openPlace: (place) => {
    import('./routeStore').then(({ useRouteStore }) => {
      const rs = useRouteStore.getState()
      if (rs.isOpen || rs.dropdownOpen) {
        const target = rs.picking || 'destination'
        const pt = { lat: place.lat, lng: place.lng, label: place.name || 'Ubicación' }
        if (target === 'origin') rs.setOrigin(pt)
        else rs.setDestination(pt)
      } else {
        set({ view: 'place', place })
      }
    })
  },
  back:               () => set((s) => ({ view: s.place ? 'nearby' : null, place: null })),
  close:              () => set({ view: null, place: null, focusedEventKey: null, eventsCategory: null }),
}))
