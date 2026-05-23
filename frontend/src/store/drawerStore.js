import { create } from 'zustand'

// Single source of truth for the side drawer.
// view: 'nearby' (categories + list) | 'place' (single place detail) | null (closed)
export const useDrawerStore = create((set) => ({
  view: null,
  place: null,

  openNearby:    () => set({ view: 'nearby',  place: null }),
  openSaved:     () => set({ view: 'saved',   place: null }),
  openEvents:    () => set({ view: 'events',  place: null }),
  openPlace:     (place) => set({ view: 'place', place }),
  back:          () => set((s) => ({ view: s.place ? 'nearby' : null, place: null })),
  close:         () => set({ view: null, place: null }),
}))
