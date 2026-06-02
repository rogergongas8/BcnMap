import { create } from 'zustand'

export const useContextMenuStore = create((set) => ({
  isOpen: false,
  x: 0,
  y: 0,
  lng: 0,
  lat: 0,
  
  openMenu: (x, y, lng, lat) => set({ isOpen: true, x, y, lng, lat }),
  closeMenu: () => set({ isOpen: false }),
}))
