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
    if (listening) { recogRef.current?.stop(); return }

    const recog = new SpeechRecognition()
    recog.lang = 'ca-ES'
    recog.interimResults = true
    recog.maxAlternatives = 1
    recogRef.current = recog

    recog.onstart  = () => setListening(true)
    recog.onend    = () => { setListening(false); setTranscript('') }
    recog.onerror  = () => { setListening(false); setTranscript('') }
    recog.onresult = (e) => {
      let interim = '', final = ''
      for (const r of e.results) {
        if (r.isFinal) final += r[0].transcript
        else interim += r[0].transcript
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

  useEffect(() => () => recogRef.current?.stop(), [])

  const displayText = listening && transcript ? transcript : text
  const canSubmit   = text.trim() && !isLoading

  return (
    <div className="flex-shrink-0" style={{ borderTop: '1px solid #1a1a1a', background: '#111111' }}>
      {/* Voice indicator */}
      {listening && (
        <div className="flex items-center gap-2 px-4 pt-3">
          <div className="flex gap-0.5 items-end h-3">
            {[0, 100, 200, 100, 0].map((d, i) => (
              <span key={i} className="w-0.5 rounded-full animate-bounce"
                style={{ background: '#E8622A', height: `${6 + i * 2}px`, animationDelay: `${d}ms`, animationDuration: '0.6s' }}
              />
            ))}
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: '#E8622A' }}>
            {transcript || 'Escoltant…'}
          </span>
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        {/* Mic */}
        {SpeechRecognition && (
          <button
            onClick={toggleVoice}
            disabled={isLoading}
            title={listening ? 'Aturar' : 'Parlar'}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0 mb-0.5 disabled:opacity-30"
            style={{
              background: listening ? 'rgba(232,98,42,0.12)' : '#1a1a1a',
              border: `1px solid ${listening ? '#E8622A55' : '#222'}`,
              color: listening ? '#E8622A' : '#444',
            }}
            onMouseEnter={e => { if (!listening) { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#333' } }}
            onMouseLeave={e => { if (!listening) { e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = '#222' } }}
          >
            {listening ? (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <rect x="4" y="4" width="8" height="8" rx="1.5" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <rect x="5.5" y="1" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M2.5 8a5.5 5.5 0 0 0 11 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <line x1="8" y1="13.5" x2="8" y2="15.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            )}
          </button>
        )}

        {/* Textarea */}
        <div className="flex-1 relative">
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
            className="w-full resize-none rounded-lg px-3 py-2 text-[12px] outline-none transition-all leading-relaxed disabled:opacity-40"
            style={{
              background: '#161616',
              border: '1px solid #222',
              color: '#EBEBEB',
              maxHeight: 80,
              caretColor: listening ? 'transparent' : '#E8622A',
            }}
            onFocus={e => { e.target.style.borderColor = '#E8622A44' }}
            onBlur={e => { e.target.style.borderColor = '#222' }}
          />
          <style>{`textarea::placeholder { color: #3a3a3a; }`}</style>
        </div>

        {/* Send */}
        <button
          onClick={() => submit()}
          disabled={!canSubmit}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0 mb-0.5 disabled:opacity-20 disabled:cursor-not-allowed"
          style={{
            background: canSubmit ? '#E8622A' : '#1a1a1a',
            border: `1px solid ${canSubmit ? '#E8622A' : '#222'}`,
            color: canSubmit ? '#fff' : '#444',
          }}
        >
          {isLoading ? (
            <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
