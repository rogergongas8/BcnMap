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
  const { isOpen, hasUnread, toggleChat, clearChat, pendingPrompt, clearPendingPrompt } = useChatStore()
  const { messages, isLoading, sendMessage } = useChat()
  const { route } = useRouteStore()
  const setMapPadding = useMapStore(s => s.setMapPadding)
  const bottomRef = useRef(null)
  const hasEverOpened = useRef(false)

  useEffect(() => {
    if (isOpen) hasEverOpened.current = true
  }, [isOpen])

  useEffect(() => {
    if (pendingPrompt && !isLoading) {
      sendMessage(pendingPrompt)
      clearPendingPrompt()
    }
  }, [pendingPrompt])

  // Map padding managed centrally in App.jsx — no local setMapPadding here

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <>
      {/* Side panel — slides in from the right edge, below the 56px TopBar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute top-14 right-0 bottom-0 z-40 w-[340px] flex flex-col
              border-l shadow-[-20px_0_60px_rgba(0,0,0,0.6)]"
            style={{ background: '#141414', borderColor: '#262626' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #262626' }}>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#3CB887' }} />
                <span className="font-syne text-[13px] font-medium" style={{ color: '#EBEBEB' }}>BCN Live AI</span>
                <span className="font-mono text-[9px]" style={{ color: '#555' }}>gemma2</span>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button onClick={clearChat} className="font-mono text-[10px] px-2 py-1 rounded transition-colors" style={{ color: '#555' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.background = '#1C1C1C' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}
                  >netejar</button>
                )}
                <button onClick={toggleChat}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-lg leading-none transition-colors"
                  style={{ color: '#555' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#EBEBEB'; e.currentTarget.style.background = '#1C1C1C' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}
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
