import React from 'react'
import { motion } from 'framer-motion'

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
          style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z"
              stroke="#22d3ee" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[82%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className="px-3 py-2.5 rounded-xl text-[12px] leading-relaxed"
          style={isUser ? {
            background: '#1e1e1e',
            border: '1px solid #2a2a2a',
            color: '#EBEBEB',
            borderBottomRightRadius: 4,
          } : {
            background: 'rgba(34,211,238,0.05)',
            border: '1px solid rgba(34,211,238,0.12)',
            color: '#c8f7ff',
            borderBottomLeftRadius: 4,
          }}
        >
          {message.text}
        </div>
        {time && (
          <span className="font-mono text-[9px] px-1" style={{ color: '#333' }}>{time}</span>
        )}
      </div>
    </motion.div>
  )
}
