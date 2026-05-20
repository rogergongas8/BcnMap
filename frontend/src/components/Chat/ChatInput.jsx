import React, { useRef, useState, useEffect, useCallback } from 'react'

const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null

export default function ChatInput({ onSend, isLoading }) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const ref  = useRef(null)
  const recogRef = useRef(null)

  const submit = useCallback((value) => {
    const msg = (value ?? text).trim()
    if (!msg || isLoading) return
    onSend(msg)
    setText('')
    setTranscript('')
    if (ref.current) ref.current.style.height = 'auto'
  }, [text, isLoading, onSend])

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

  const toggleVoice = useCallback(() => {
    if (!SpeechRecognition) return

    if (listening) {
      recogRef.current?.stop()
      return
    }

    const recog = new SpeechRecognition()
    recog.lang = 'ca-ES'
    recog.interimResults = true
    recog.maxAlternatives = 1
    recogRef.current = recog

    recog.onstart  = () => setListening(true)
    recog.onend    = () => { setListening(false); setTranscript('') }
    recog.onerror  = () => { setListening(false); setTranscript('') }

    recog.onresult = (e) => {
      let interim = ''
      let final   = ''
      for (const result of e.results) {
        if (result.isFinal) final   += result[0].transcript
        else                interim += result[0].transcript
      }
      setTranscript(interim)
      if (final) {
        setText(prev => (prev + ' ' + final).trimStart())
        setTranscript('')
        if (ref.current) {
          ref.current.style.height = 'auto'
          ref.current.style.height = Math.min(ref.current.scrollHeight, 80) + 'px'
        }
      }
    }

    recog.start()
  }, [listening])

  // Auto-stop recognition when unmounting
  useEffect(() => () => recogRef.current?.stop(), [])

  const displayText = listening && transcript ? transcript : text
  const canSubmit   = text.trim() && !isLoading

  return (
    <div className="border-t border-white/[0.06]">
      {/* Listening indicator */}
      {listening && (
        <div className="flex items-center gap-2 px-3 pt-2.5">
          <div className="flex gap-0.5 items-end h-3">
            {[0, 100, 200, 100, 0].map((d, i) => (
              <span
                key={i}
                className="w-0.5 rounded-full animate-bounce"
                style={{
                  background: '#E8622A',
                  height: `${8 + i * 2}px`,
                  animationDelay: `${d}ms`,
                  animationDuration: '0.6s',
                }}
              />
            ))}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: '#E8622A' }}>
            {transcript || 'Escoltant…'}
          </span>
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        {/* Mic button */}
        {SpeechRecognition && (
          <button
            onClick={toggleVoice}
            disabled={isLoading}
            title={listening ? 'Aturar' : 'Parlar'}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0 mb-0.5 disabled:opacity-30"
            style={{
              background: listening ? '#E8622A1A' : '#1C1C1C',
              border: `1px solid ${listening ? '#E8622A' : '#262626'}`,
              color: listening ? '#E8622A' : '#555',
            }}
          >
            {listening ? (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <rect x="4" y="4" width="8" height="8" rx="1" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <rect x="5.5" y="1" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M2.5 8a5.5 5.5 0 0 0 11 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <line x1="8" y1="13.5" x2="8" y2="15.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            )}
          </button>
        )}

        <textarea
          ref={ref}
          value={displayText}
          onInput={onInput}
          onKeyDown={onKeyDown}
          onChange={(e) => { if (!listening) setText(e.target.value) }}
          placeholder={listening ? 'Parla ara…' : 'Pregunta sobre Barcelona...'}
          rows={1}
          disabled={isLoading}
          readOnly={listening}
          className="flex-1 resize-none bg-white/5 border border-white/10 focus:border-cyan-500/50
            rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none
            transition-colors disabled:opacity-40 leading-relaxed"
          style={{ maxHeight: 80, caretColor: listening ? 'transparent' : undefined }}
        />

        <button
          onClick={() => submit()}
          disabled={!canSubmit}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-cyan-500/20
            border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-colors
            disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 mb-0.5"
        >
          {isLoading ? (
            <span className="w-3 h-3 border border-cyan-400/60 border-t-cyan-400 rounded-full animate-spin" />
          ) : '→'}
        </button>
      </div>
    </div>
  )
}
