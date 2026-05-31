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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="absolute top-0 right-0 bottom-0 z-50 w-[340px] flex flex-col"
          style={{
            background: '#121008',
            borderLeft: '1px solid #2C2926',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
          }}
        >
            {/* ── Header (same height as TopBar: 56px) ── */}
            <div
              className="h-14 flex items-center justify-between px-4 flex-shrink-0"
              style={{ borderBottom: '1px solid #201E1B' }}
            >
              {/* Left: AI identity */}
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(184,136,90,0.1)', border: '1px solid rgba(184,136,90,0.2)' }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z"
                        stroke="#B8885A" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                      <circle cx="5.5" cy="7.5" r="0.8" fill="#B8885A"/>
                      <circle cx="8"   cy="7.5" r="0.8" fill="#B8885A"/>
                      <circle cx="10.5" cy="7.5" r="0.8" fill="#B8885A"/>
                    </svg>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#121008]"
                    style={{ background: '#3CB887' }} />
                </div>
                <div>
                  <p className="font-syne text-[12px] font-semibold leading-tight" style={{ color: '#F7F6F4' }}>
                    BCN Live AI
                  </p>
                  <p className="font-mono text-[9px] leading-tight mt-0.5" style={{ color: '#7D7975' }}>
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
                    style={{ color: '#7D7975', background: 'transparent' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#B0ACA7'; e.currentTarget.style.background = '#211F1B' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#7D7975'; e.currentTarget.style.background = 'transparent' }}
                  >
                    netejar
                  </button>
                )}
                <button
                  onClick={toggleChat}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                  style={{ color: '#7D7975' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#F7F6F4'; e.currentTarget.style.background = '#211F1B' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#7D7975'; e.currentTarget.style.background = 'transparent' }}
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
                  style={{ background: 'rgba(184,136,90,0.06)', borderBottom: '1px solid rgba(184,136,90,0.12)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#B8885A' }} />
                  <span className="font-mono text-[10px] flex-1 truncate" style={{ color: 'rgba(184,136,90,0.75)' }}>
                    Ruta activa en el mapa
                  </span>
                  <button
                    onClick={() => useRouteStore.getState().togglePanel()}
                    className="font-mono text-[10px] transition-colors"
                    style={{ color: 'rgba(184,136,90,0.6)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#B8885A' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(184,136,90,0.6)' }}
                  >
                    veure →
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Messages area ── */}
            <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2C2926 transparent' }}>
              {messages.length === 0 ? (
                /* Empty state — vertically centered */
                <div className="h-full flex flex-col items-center justify-center gap-6 px-4 py-8">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(184,136,90,0.08)', border: '1px solid rgba(184,136,90,0.18)' }}>
                      <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z"
                          stroke="#B8885A" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                        <circle cx="5.5" cy="7.5" r="0.8" fill="#B8885A"/>
                        <circle cx="8"   cy="7.5" r="0.8" fill="#B8885A"/>
                        <circle cx="10.5" cy="7.5" r="0.8" fill="#B8885A"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-syne text-[13px] font-medium mb-1" style={{ color: '#F7F6F4' }}>
                        Hola, sóc BCN Live AI
                      </p>
                      <p className="font-mono text-[10px] leading-relaxed" style={{ color: '#8C8884' }}>
                        Pregunta'm sobre trànsit, transport,<br/>Bicing o demana'm una ruta
                      </p>
                    </div>
                  </div>

                  <div className="w-full flex flex-col gap-1.5">
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] mb-1" style={{ color: '#6B6865' }}>
                      Prova amb
                    </p>
                    {SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s)}
                        className="text-left px-3 py-2.5 rounded-lg font-mono text-[11px] transition-all w-full"
                        style={{
                          color: '#B0ACA7',
                          background: '#181512',
                          border: '1px solid #252220',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.color = '#F7F6F4'
                          e.currentTarget.style.background = '#1E1C19'
                          e.currentTarget.style.borderColor = '#3D3A36'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.color = '#B0ACA7'
                          e.currentTarget.style.background = '#181512'
                          e.currentTarget.style.borderColor = '#252220'
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
                        style={{ background: 'rgba(184,136,90,0.1)', border: '1px solid rgba(184,136,90,0.15)' }}>
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                          <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z"
                            stroke="#B8885A" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                        </svg>
                      </div>
                      <div className="px-3 py-2.5 rounded-xl rounded-tl-sm"
                        style={{ background: '#1E1C19', border: '1px solid #2C2926' }}>
                        <div className="flex gap-1 items-center h-4">
                          {[0, 150, 300].map(d => (
                            <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                              style={{ background: '#B8885A', opacity: 0.5, animationDelay: `${d}ms` }} />
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
