import { create } from 'zustand'

const ALL_CATEGORIES = [
  { id: 'restaurant',  emoji: '🍽',  label: 'Restaurantes' },
  { id: 'cafe',        emoji: '☕',  label: 'Cafés' },
  { id: 'bar',         emoji: '🍺',  label: 'Bares' },
  { id: 'bakery',      emoji: '🥐',  label: 'Panaderías' },
  { id: 'supermarket', emoji: '🛒',  label: 'Súper' },
  { id: 'pharmacy',    emoji: '⚕',  label: 'Farmacias' },
  { id: 'hospital',    emoji: '✚',  label: 'Hospitales' },
  { id: 'bank',        emoji: '$',  label: 'Bancos' },
  { id: 'museum',      emoji: '🏛',  label: 'Museos' },
  { id: 'attraction',  emoji: '✦',  label: 'Atracciones' },
  { id: 'monument',    emoji: '◆',  label: 'Monumentos' },
  { id: 'hotel',       emoji: '🛏',  label: 'Hoteles' },
]

export const NEARBY_CATEGORIES = ALL_CATEGORIES

export const useNearbyStore = create((set, get) => ({
  isOpen:        false,
  activeCategory: null,
  pois:          [],
  isLoading:     false,
  selectedPoi:   null,
  centerOverride: null,

  togglePanel: () => set(s => ({ isOpen: !s.isOpen, activeCategory: s.isOpen ? null : s.activeCategory, pois: [] })),
  closePanel:  () => set({ isOpen: false, activeCategory: null, pois: [], selectedPoi: null }),
  setCategory: (id) => set(s => ({ activeCategory: s.activeCategory === id ? null : id, pois: [], selectedPoi: null })),
  setPois:     (list) => set({ pois: list }),
  setLoading:  (b) => set({ isLoading: b }),
  selectPoi:   (p) => set({ selectedPoi: p }),
  clearSelected: () => set({ selectedPoi: null }),
}))
