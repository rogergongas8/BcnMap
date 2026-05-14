import { create } from 'zustand'

export const useChatStore = create((set) => ({
  messages:  [],
  isLoading: false,
  isOpen:    false,
  hasUnread: false,

  toggleChat:  () => set((s) => ({ isOpen: !s.isOpen, hasUnread: false })),
  openChat:    () => set({ isOpen: true, hasUnread: false }),
  setLoading:  (val) => set({ isLoading: val }),
  clearChat:   () => set({ messages: [] }),

  addMessage: (role, text) => set((s) => ({
    messages: [
      ...s.messages,
      { id: Date.now(), role, text, timestamp: new Date() },
    ],
    hasUnread: role === 'assistant' && !s.isOpen,
  })),
}))
