import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChatStore } from '../../store/chatStore'
import { useRouteStore } from '../../store/routeStore'
import { useMapStore } from '../../store/mapStore'
import { useChat } from '../../hooks/useChat'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'

const SUGGESTIONS = [
  '¿Dónde hay Bicing disponible?',
  '¿Cómo está el tráfico ahora?',
  'Llévame a la Sagrada Família',
  '¿Qué eventos hay hoy?',
]

export default function ChatPanel() {
  const { isOpen, hasUnread, toggleChat, clearChat } = useChatStore()
  const { messages, isLoading, sendMessage } = useChat()
  const { route } = useRouteStore()
  const setMapPadding = useMapStore(s => s.setMapPadding)
  const bottomRef = useRef(null)
  const hasEverOpened = useRef(false)

  useEffect(() => {
    if (isOpen) hasEverOpened.current = true
  }, [isOpen])

  // Ajusta el padding del mapa para que la ruta no quede tapada por el panel lateral
  useEffect(() => {
    setMapPadding(isOpen ? { right: 340 } : { right: 0 })
  }, [isOpen, setMapPadding])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <>
      {/* Toggle button — bottom-right, above MapControls */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="chat-btn"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ delay: hasEverOpened.current ? 0 : 4.4, duration: 0.25 }}
            onClick={toggleChat}
            title="Chat IA"
            className="absolute bottom-[200px] right-4 z-40 w-10 h-10
              flex items-center justify-center rounded-xl
              panel-glass border border-cyan-500/25
              text-cyan-400/70 hover:text-cyan-300 hover:border-cyan-400/50
              transition-all duration-200"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z"
                stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
              <circle cx="5.5" cy="7.5" r="0.8" fill="currentColor"/>
              <circle cx="8" cy="7.5" r="0.8" fill="currentColor"/>
              <circle cx="10.5" cy="7.5" r="0.8" fill="currentColor"/>
            </svg>
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full border border-black/50" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Side panel — slides in from the right edge */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute top-0 right-0 bottom-0 z-40 w-[340px] flex flex-col
              bg-[#0a0c10] border-l border-white/[0.07]
              shadow-[-20px_0_60px_rgba(0,0,0,0.6)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] flex-shrink-0 mt-0">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-white/80 text-sm font-mono tracking-wide">BCN Live AI</span>
                <span className="text-white/20 text-[10px] font-mono">llama-3.3</span>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    title="Limpiar chat"
                    className="text-white/20 hover:text-white/60 transition-colors text-[10px] font-mono px-1.5 py-1 rounded hover:bg-white/5"
                  >
                    limpiar
                  </button>
                )}
                <button
                  onClick={toggleChat}
                  className="text-white/25 hover:text-white/70 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.05] text-lg leading-none"
                >×</button>
              </div>
            </div>

            {/* Route indicator */}
            <AnimatePresence>
              {route && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-3 py-2 bg-cyan-500/[0.06] border-b border-cyan-500/[0.12] flex-shrink-0"
                >
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full flex-shrink-0" />
                  <span className="text-cyan-300/70 text-[11px] font-mono flex-1 truncate">
                    Ruta activa en el mapa
                  </span>
                  <button
                    onClick={() => useRouteStore.getState().togglePanel()}
                    className="text-cyan-400/60 hover:text-cyan-300 text-[10px] font-mono flex-shrink-0"
                  >
                    ver →
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">
              {messages.length === 0 && (
                <div className="flex flex-col gap-4 h-full">
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z"
                          stroke="#22d3ee" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                        <circle cx="5.5" cy="7.5" r="0.8" fill="#22d3ee"/>
                        <circle cx="8" cy="7.5" r="0.8" fill="#22d3ee"/>
                        <circle cx="10.5" cy="7.5" r="0.8" fill="#22d3ee"/>
                      </svg>
                    </div>
                    <p className="text-white/30 text-xs leading-relaxed text-center max-w-[220px]">
                      Pregúntame sobre tráfico, transporte, bicing o pídeme una ruta
                    </p>
                  </div>
                  {/* Quick suggestions */}
                  <div className="flex flex-col gap-1.5 pb-1">
                    {SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s)}
                        className="text-left px-3 py-2 rounded-lg text-[11px] text-white/40
                          hover:text-white/70 hover:bg-white/[0.04] transition-colors
                          border border-white/[0.04] hover:border-white/[0.08]
                          font-mono leading-tight"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <div className="flex items-start gap-2">
                  <div className="px-3 py-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl rounded-bl-sm">
                    <div className="flex gap-1">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <ChatInput onSend={sendMessage} isLoading={isLoading} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
