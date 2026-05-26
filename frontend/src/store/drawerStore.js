import { create } from 'zustand'

// Single source of truth for the side drawer.
// view: 'nearby' (categories + list) | 'place' (single place detail) | null (closed)
export const useDrawerStore = create((set) => ({
  view: null,
  place: null,
  focusedEventKey: null,

  openNearby:         () => set({ view: 'nearby',       place: null, focusedEventKey: null }),
  openSaved:          () => set({ view: 'saved',        place: null, focusedEventKey: null }),
  openEvents:         () => set({ view: 'events',       place: null, focusedEventKey: null }),
  openDisruptions:    () => set({ view: 'disruptions',  place: null, focusedEventKey: null }),
  openEventFocused:   (key) => set({ view: 'events', place: null, focusedEventKey: key }),
  clearEventFocus:    () => set({ focusedEventKey: null }),
  openPlace:          (place) => set({ view: 'place', place }),
  back:               () => set((s) => ({ view: s.place ? 'nearby' : null, place: null })),
  close:              () => set({ view: null, place: null, focusedEventKey: null }),
}))
