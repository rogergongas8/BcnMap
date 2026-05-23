import { create } from 'zustand'

export const useChatStore = create((set) => ({
  messages:        [],
  isLoading:       false,
  isOpen:          false,
  hasUnread:       false,
  pendingPrompt:   null,
  suppressMapMove: false,

  toggleChat:  () => set((s) => ({ isOpen: !s.isOpen, hasUnread: false })),
  openChat:    () => set({ isOpen: true, hasUnread: false }),
  setLoading:  (val) => set({ isLoading: val }),
  clearChat:   () => set({ messages: [] }),
  clearPendingPrompt: () => set({ pendingPrompt: null }),

  // Normal: opens chat and queues a prompt, AI can move the map
  openChatWithPrompt: (msg) => set({ isOpen: true, hasUnread: false, pendingPrompt: msg, suppressMapMove: false }),
  // Info-only: used from POI/event cards — AI reply won't fly the camera
  openChatWithPromptNoFly: (msg) => set({ isOpen: true, hasUnread: false, pendingPrompt: msg, suppressMapMove: true }),
  clearSuppressMapMove: () => set({ suppressMapMove: false }),

  addMessage: (role, text) => set((s) => ({
    messages: [
      ...s.messages,
      { id: Date.now(), role, text, timestamp: new Date() },
    ],
    hasUnread: role === 'assistant' && !s.isOpen,
  })),
}))
