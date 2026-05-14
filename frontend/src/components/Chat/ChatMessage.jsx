import React from 'react'
import { motion } from 'framer-motion'

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  const time   = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
    >
      <div
        className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
          isUser
            ? 'bg-white/10 text-white rounded-br-sm'
            : 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-50 rounded-bl-sm'
        }`}
      >
        {message.text}
      </div>
      <span className="text-white/20 text-[10px] font-mono">{time}</span>
    </motion.div>
  )
}
