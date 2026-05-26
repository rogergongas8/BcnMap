import { create } from 'zustand'
import { Icons } from '../components/UI/icons'

export const NEARBY_CATEGORIES = [
  { id: 'restaurant',  label: 'Restaurantes', icon: Icons.restaurant },
  { id: 'cafe',        label: 'Cafés',        icon: Icons.cafe },
  { id: 'bar',         label: 'Bares',        icon: Icons.bar },
  { id: 'bakery',      label: 'Panaderías',   icon: Icons.bakery },
  { id: 'supermarket', label: 'Súper',        icon: Icons.cart },
  { id: 'pharmacy',    label: 'Farmacias',    icon: Icons.pharmacy },
  { id: 'hospital',    label: 'Hospitales',   icon: Icons.hospital },
  { id: 'bank',        label: 'Bancos',       icon: Icons.bank },
  { id: 'museum',      label: 'Museos',       icon: Icons.museum },
  { id: 'attraction',  label: 'Atracciones',  icon: Icons.star },
  { id: 'monument',    label: 'Monumentos',   icon: Icons.monument },
  { id: 'hotel',       label: 'Hoteles',      icon: Icons.hotel },
  { id: 'events',      label: 'Esdeveniments', icon: Icons.calendar, isEvents: true },
]

export const useNearbyStore = create((set) => ({
  activeCategory: null,
  pois:           [],
  isLoading:      false,
  hoveredId:      null,

  setCategory:  (id) => set((s) => ({
    activeCategory: s.activeCategory === id ? null : id,
    pois:           s.activeCategory === id ? [] : s.pois,
  })),
  clearCategory: () => set({ activeCategory: null, pois: [] }),
  setPois:      (list) => set({ pois: list }),
  setLoading:   (b) => set({ isLoading: b }),
  setHovered:   (id) => set({ hoveredId: id }),
}))
