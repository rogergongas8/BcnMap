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
    <div className="flex-shrink-0" style={{ borderTop: '1px solid #201E1B', background: '#121008' }}>
      {/* Voice indicator */}
      {listening && (
        <div className="flex items-center gap-2 px-4 pt-3">
          <div className="flex gap-0.5 items-end h-3">
            {[0, 100, 200, 100, 0].map((d, i) => (
              <span key={i} className="w-0.5 rounded-full animate-bounce"
                style={{ background: '#B8885A', height: `${6 + i * 2}px`, animationDelay: `${d}ms`, animationDuration: '0.6s' }}
              />
            ))}
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: '#B8885A' }}>
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
              background: listening ? 'rgba(184,136,90,0.12)' : '#1E1C19',
              border: `1px solid ${listening ? '#B8885A55' : '#2C2926'}`,
              color: listening ? '#B8885A' : '#8C8884',
            }}
            onMouseEnter={e => { if (!listening) { e.currentTarget.style.color = '#B0ACA7'; e.currentTarget.style.borderColor = '#3D3A36' } }}
            onMouseLeave={e => { if (!listening) { e.currentTarget.style.color = '#8C8884'; e.currentTarget.style.borderColor = '#2C2926' } }}
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
              background: '#181512',
              border: '1px solid #2C2926',
              color: '#F7F6F4',
              maxHeight: 80,
              caretColor: listening ? 'transparent' : '#B8885A',
            }}
            onFocus={e => { e.target.style.borderColor = '#B8885A44' }}
            onBlur={e => { e.target.style.borderColor = '#222' }}
          />
          <style>{`textarea::placeholder { color: #7D7975; }`}</style>
        </div>

        {/* Send */}
        <button
          onClick={() => submit()}
          disabled={!canSubmit}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0 mb-0.5 disabled:opacity-20 disabled:cursor-not-allowed"
          style={{
            background: canSubmit ? '#B8885A' : '#1E1C19',
            border: `1px solid ${canSubmit ? '#B8885A' : '#2C2926'}`,
            color: canSubmit ? '#fff' : '#8C8884',
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
