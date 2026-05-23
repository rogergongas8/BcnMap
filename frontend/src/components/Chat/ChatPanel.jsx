import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChatStore } from '../../store/chatStore'
import { useRouteStore } from '../../store/routeStore'
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
  const { isOpen, toggleChat, clearChat, pendingPrompt, clearPendingPrompt } = useChatStore()
  const { messages, isLoading, sendMessage } = useChat()
  const { route } = useRouteStore()
  const bottomRef = useRef(null)

  useEffect(() => {
    if (pendingPrompt && !isLoading) {
      sendMessage(pendingPrompt)
      clearPendingPrompt()
    }
  }, [pendingPrompt])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="chat-panel"
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ duration: 0.26, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute top-0 right-0 bottom-0 z-50 w-[340px] flex flex-col"
          style={{
            background: '#111111',
            borderLeft: '1px solid #262626',
            boxShadow: '-4px 0 16px rgba(0,0,0,0.35)',
          }}
        >
          {/* ── Header (same height as TopBar: 56px) ── */}
          <div
            className="h-14 flex items-center justify-between px-4 flex-shrink-0"
            style={{ borderBottom: '1px solid #1a1a1a' }}
          >
            {/* Left: AI identity */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z"
                      stroke="#22d3ee" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                    <circle cx="5.5" cy="7.5" r="0.8" fill="#22d3ee"/>
                    <circle cx="8"   cy="7.5" r="0.8" fill="#22d3ee"/>
                    <circle cx="10.5" cy="7.5" r="0.8" fill="#22d3ee"/>
                  </svg>
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#111]"
                  style={{ background: '#3CB887' }} />
              </div>
              <div>
                <p className="font-syne text-[12px] font-semibold leading-tight" style={{ color: '#EBEBEB' }}>
                  BCN Live AI
                </p>
                <p className="font-mono text-[9px] leading-tight mt-0.5" style={{ color: '#444' }}>
                  llama-3.1-8b · en línia
                </p>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="h-7 px-2.5 font-mono text-[10px] rounded-md transition-colors"
                  style={{ color: '#444', background: 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.background = '#1C1C1C' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#444'; e.currentTarget.style.background = 'transparent' }}
                >
                  netejar
                </button>
              )}
              <button
                onClick={toggleChat}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: '#444' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#EBEBEB'; e.currentTarget.style.background = '#1C1C1C' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#444'; e.currentTarget.style.background = 'transparent' }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <line x1="1.5" y1="1.5" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="10.5" y1="1.5" x2="1.5" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* ── Active route banner ── */}
          <AnimatePresence>
            {route && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
                style={{ background: 'rgba(34,211,238,0.04)', borderBottom: '1px solid rgba(34,211,238,0.1)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#22d3ee' }} />
                <span className="font-mono text-[10px] flex-1 truncate" style={{ color: 'rgba(34,211,238,0.6)' }}>
                  Ruta activa en el mapa
                </span>
                <button
                  onClick={() => useRouteStore.getState().togglePanel()}
                  className="font-mono text-[10px] transition-colors"
                  style={{ color: 'rgba(34,211,238,0.5)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'rgba(34,211,238,0.9)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(34,211,238,0.5)' }}
                >
                  veure →
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Messages area ── */}
          <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e1e1e transparent' }}>
            {messages.length === 0 ? (
              /* Empty state — vertically centered */
              <div className="h-full flex flex-col items-center justify-center gap-6 px-4 py-8">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.12)' }}>
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                      <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z"
                        stroke="#22d3ee" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                      <circle cx="5.5" cy="7.5" r="0.8" fill="#22d3ee"/>
                      <circle cx="8"   cy="7.5" r="0.8" fill="#22d3ee"/>
                      <circle cx="10.5" cy="7.5" r="0.8" fill="#22d3ee"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-syne text-[13px] font-medium mb-1" style={{ color: '#EBEBEB' }}>
                      Hola, sóc BCN Live AI
                    </p>
                    <p className="font-mono text-[10px] leading-relaxed" style={{ color: '#444' }}>
                      Pregunta'm sobre trànsit, transport,<br/>Bicing o demana'm una ruta
                    </p>
                  </div>
                </div>

                <div className="w-full flex flex-col gap-1.5">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] mb-1" style={{ color: '#333' }}>
                    Prova amb
                  </p>
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="text-left px-3 py-2.5 rounded-lg font-mono text-[11px] transition-all w-full"
                      style={{
                        color: '#555',
                        background: '#161616',
                        border: '1px solid #1e1e1e',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = '#EBEBEB'
                        e.currentTarget.style.background = '#1a1a1a'
                        e.currentTarget.style.borderColor = '#2a2a2a'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = '#555'
                        e.currentTarget.style.background = '#161616'
                        e.currentTarget.style.borderColor = '#1e1e1e'
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Messages list */
              <div className="flex flex-col gap-4 px-4 py-4">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {isLoading && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z"
                          stroke="#22d3ee" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                      </svg>
                    </div>
                    <div className="px-3 py-2.5 rounded-xl rounded-tl-sm"
                      style={{ background: '#1a1a1a', border: '1px solid #222' }}>
                      <div className="flex gap-1 items-center h-4">
                        {[0, 150, 300].map(d => (
                          <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                            style={{ background: '#22d3ee', opacity: 0.5, animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* ── Input ── */}
          <ChatInput onSend={sendMessage} isLoading={isLoading} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
