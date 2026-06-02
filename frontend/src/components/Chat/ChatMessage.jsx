import React from 'react'
import { motion } from 'framer-motion'
import { executeSuggestionAction } from '../../hooks/useChat'

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  const time   = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar — only for AI */}
      {!isUser && (
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(184,136,90,0.1)', border: '1px solid rgba(184,136,90,0.2)' }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z"
              stroke="#B8885A" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
      )}

      <div className={`flex flex-col gap-1.5 max-w-[82%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className="px-3 py-2.5 rounded-xl text-[12px] leading-relaxed"
          style={isUser ? {
            background: '#1E1C19',
            border: '1px solid #302D29',
            color: '#F7F6F4',
            borderBottomRightRadius: 4,
          } : {
            background: 'rgba(184,136,90,0.07)',
            border: '1px solid rgba(184,136,90,0.15)',
            color: '#D4C8B8',
            borderBottomLeftRadius: 4,
          }}
        >
          {message.text}
        </div>

        {/* Suggestion chips */}
        {!isUser && message.suggestions?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.08 }}
            className="flex flex-col gap-1.5 w-full"
          >
            {message.suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => executeSuggestionAction(s)}
                className="text-left px-3 py-2 font-mono text-[11px] transition-all"
                style={{
                  borderRadius: 8,
                  background: 'rgba(184,136,90,0.06)',
                  border: '1px solid rgba(184,136,90,0.2)',
                  color: '#B8885A',
                  width: '100%',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(184,136,90,0.12)'
                  e.currentTarget.style.borderColor = 'rgba(184,136,90,0.4)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(184,136,90,0.06)'
                  e.currentTarget.style.borderColor = 'rgba(184,136,90,0.2)'
                }}
              >
                {s.label}
              </button>
            ))}
          </motion.div>
        )}

        {time && (
          <span className="font-mono text-[9px] px-1" style={{ color: '#6B6865' }}>{time}</span>
        )}
      </div>
    </motion.div>
  )
}
