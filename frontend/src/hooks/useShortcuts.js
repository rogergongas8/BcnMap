import { useEffect } from 'react'
import { useChatStore } from '../store/chatStore'
import { useDrawerStore } from '../store/drawerStore'
import { useMapStore } from '../store/mapStore'

export function useShortcuts() {
  const toggleChat   = useChatStore(s => s.toggleChat)
  const isChatOpen   = useChatStore(s => s.isOpen)
  const closeDrawer  = useDrawerStore(s => s.close)
  const isDrawerOpen = useDrawerStore(s => !!s.view)
  const toggleLayer  = useMapStore(s => s.toggleLayer)

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K or Ctrl+K -> Toggle Chat
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggleChat()
        return
      }

      // Escape -> Close things (first drawer, then chat, or active focus)
      if (e.key === 'Escape') {
        if (isDrawerOpen) {
          closeDrawer()
          e.preventDefault()
          return
        }
        if (isChatOpen) {
          toggleChat() // Closes it if open
          e.preventDefault()
          return
        }
      }

      // Layer toggles (only if not typing in an input)
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) {
        return
      }

      const key = e.key.toLowerCase()
      if (key === 'm') toggleLayer('metro')
      if (key === 'b') toggleLayer('bicing')
      if (key === 'e') toggleLayer('events')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleChat, closeDrawer, isDrawerOpen, isChatOpen, toggleLayer])
}
