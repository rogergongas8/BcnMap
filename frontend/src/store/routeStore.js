import { create } from 'zustand'

export const useRouteStore = create((set) => ({
  isOpen:      false,
  mode:        'foot',
  origin:      null,      // { lat, lng, label }
  destination: null,      // { lat, lng, label }
  picking:     null,      // 'origin' | 'destination' | null
  route:       null,      // { segments, distance, duration }
  isLoading:   false,
  error:       null,

  // Navigation mode
  isNavigating:     false,
  currentStepIndex: 0,
  offRoute:         false,

  // Signal set by the chat to open the SearchBar with pre-filled data.
  // SearchBar consumes and clears it.
  chatRequest:  null,     // { origin, destination, mode, route } | null

  togglePanel:    () => set(s => ({ isOpen: !s.isOpen, picking: null, error: null })),
  closePanel:     () => set({ isOpen: false, picking: null, origin: null, destination: null, route: null, error: null, isNavigating: false, currentStepIndex: 0 }),
  setMode:        (mode) => set({ mode, route: null }),
  setOrigin:      (pt)   => set({ origin: pt, route: null }),
  setDestination: (pt)   => set({ destination: pt, route: null }),
  setPicking:     (p)    => set({ picking: p }),
  setRoute:       (r)    => set({ route: r, error: null }),
  setLoading:     (b)    => set({ isLoading: b }),
  setError:       (e)    => set({ error: e, isLoading: false }),
  clearRoute:     ()     => set({ origin: null, destination: null, route: null, picking: null, error: null, isNavigating: false, currentStepIndex: 0 }),

  startNavigation: () => set({ isNavigating: true, currentStepIndex: 0, offRoute: false }),
  stopNavigation:  () => set({ isNavigating: false, currentStepIndex: 0, offRoute: false }),
  advanceStep:     () => set(s => ({ currentStepIndex: s.currentStepIndex + 1 })),

  // Chat-triggered route: sets everything and signals the SearchBar to open.
  setChatRequest: (req)  => set({ chatRequest: req }),
  clearChatRequest: ()   => set({ chatRequest: null }),
}))
