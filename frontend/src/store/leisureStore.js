import { create } from 'zustand'

export const useLeisureStore = create((set) => ({
  showBeaches: false,
  beaches:     [],
  selectedBeach: null,
  isLoading:   false,

  toggleBeaches: () => set(s => ({ showBeaches: !s.showBeaches, selectedBeach: null })),
  setBeaches:    (list) => set({ beaches: list }),
  setLoading:    (b)    => set({ isLoading: b }),
  selectBeach:   (b)    => set({ selectedBeach: b }),
  clearSelected: ()     => set({ selectedBeach: null }),
}))
