import React, { useRef, useState } from 'react'

export default function ChatInput({ onSend, isLoading }) {
  const [text, setText] = useState('')
  const ref  = useRef(null)

  const submit = () => {
    if (!text.trim() || isLoading) return
    onSend(text)
    setText('')
    if (ref.current) ref.current.style.height = 'auto'
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const onInput = (e) => {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
  }

  return (
    <div className="flex items-end gap-2 p-3 border-t border-white/[0.06]">
      <textarea
        ref={ref}
        value={text}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onChange={(e) => setText(e.target.value)}
        placeholder="Pregunta sobre Barcelona..."
        rows={1}
        disabled={isLoading}
        className="flex-1 resize-none bg-white/5 border border-white/10 focus:border-cyan-500/50
          rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none
          transition-colors disabled:opacity-40 leading-relaxed"
        style={{ maxHeight: 80 }}
      />
      <button
        onClick={submit}
        disabled={!text.trim() || isLoading}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-cyan-500/20
          border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-colors
          disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 mb-0.5"
      >
        {isLoading ? (
          <span className="w-3 h-3 border border-cyan-400/60 border-t-cyan-400 rounded-full animate-spin" />
        ) : '→'}
      </button>
    </div>
  )
}
