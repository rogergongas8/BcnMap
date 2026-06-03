import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../../store/authStore'
import { useAuth } from '../../hooks/useAuth'

const MODES = [
  { id: 'foot',   label: 'A peu',  color: '#a78bfa' },
  { id: 'bicing', label: 'Bicing', color: '#00ff88' },
  { id: 'metro',  label: 'Metro',  color: '#ff6b35' },
  { id: 'bus',    label: 'Bus',    color: '#00b4ff' },
  { id: 'car',    label: 'Cotxe',  color: '#ffaa00' },
]

export default function PreferencesModal({ onClose }) {
  const storedPrefs    = useAuthStore(s => s.preferences)
  const { savePreferences } = useAuth()

  const [hasBicing,  setHasBicing]  = useState(storedPrefs?.has_bicing ?? false)
  const [avoidModes, setAvoidModes] = useState(new Set(storedPrefs?.avoid_modes ?? []))
  const [maxWalk,    setMaxWalk]    = useState(storedPrefs?.max_walk_minutes ?? 15)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)

  const toggleMode = (id) => {
    setAvoidModes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await savePreferences({
        has_bicing:        hasBicing,
        avoid_modes:       [...avoidModes],
        max_walk_minutes:  maxWalk,
      })
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 800)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
        className="w-[380px] max-w-[94vw]"
        style={{ background: '#151210', border: '1px solid #2C2926', borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.8)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #2C2926' }}>
          <h2 className="font-syne text-[14px] font-semibold" style={{ color: '#F7F6F4' }}>Preferències de transport</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
            style={{ color: '#8C8884' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#F7F6F4'; e.currentTarget.style.background = '#211F1B' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#8C8884'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-5">
          {/* Bicing toggle */}
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] mb-3" style={{ color: '#8C8884' }}>Bicing</p>
            <button
              onClick={() => setHasBicing(v => !v)}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-lg transition-all"
              style={{
                background: hasBicing ? 'rgba(0,255,136,0.06)' : '#211F1B',
                border:     `1px solid ${hasBicing ? 'rgba(0,255,136,0.35)' : '#2C2926'}`,
              }}
            >
              <div>
                <p className="font-syne text-[13px] font-medium text-left" style={{ color: hasBicing ? '#00ff88' : '#B0ACA7' }}>
                  Tinc targeta Bicing
                </p>
                <p className="font-mono text-[10px] mt-0.5 text-left" style={{ color: '#6B6865' }}>
                  {hasBicing ? "S'activarà Bicing en rutes rellevants" : 'Desactivat'}
                </p>
              </div>
              {/* Toggle pill */}
              <div
                className="w-10 h-5 rounded-full flex-shrink-0 relative transition-all"
                style={{ background: hasBicing ? '#00ff88' : '#2C2926' }}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                  style={{ background: '#fff', left: hasBicing ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
                />
              </div>
            </button>
          </div>

          {/* Mode preferences */}
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] mb-3" style={{ color: '#8C8884' }}>Modes a evitar</p>
            <div className="flex flex-col gap-1.5">
              {MODES.map(m => {
                const avoided = avoidModes.has(m.id)
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleMode(m.id)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all w-full text-left"
                    style={{
                      background: avoided ? '#211F1B' : 'transparent',
                      border:     `1px solid ${avoided ? '#2C2926' : 'transparent'}`,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: avoided ? '#3C3A37' : m.color, opacity: avoided ? 0.4 : 1 }}
                    />
                    <span className="font-syne text-[12px] flex-1" style={{ color: avoided ? '#6B6865' : '#B0ACA7' }}>{m.label}</span>
                    {avoided && (
                      <span className="font-mono text-[9px] uppercase tracking-wide" style={{ color: '#6B6865' }}>Evitat</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Max walk */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.15em]" style={{ color: '#8C8884' }}>Maxim a peu sense alternativa</p>
              <span className="font-syne text-[13px] font-semibold" style={{ color: '#B8885A' }}>{maxWalk} min</span>
            </div>
            <input
              type="range" min={5} max={60} step={5} value={maxWalk}
              onChange={e => setMaxWalk(Number(e.target.value))}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{
                accentColor: '#B8885A',
                background:  `linear-gradient(to right, #B8885A ${((maxWalk - 5) / 55) * 100}%, #2C2926 ${((maxWalk - 5) / 55) * 100}%)`,
              }}
            />
            <div className="flex justify-between mt-1">
              <span className="font-mono text-[9px]" style={{ color: '#4C4A46' }}>5 min</span>
              <span className="font-mono text-[9px]" style={{ color: '#4C4A46' }}>60 min</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 font-syne text-[13px] font-semibold transition-all rounded-lg"
            style={{
              background: saved ? 'rgba(0,255,136,0.12)' : '#B8885A',
              border:     `1px solid ${saved ? 'rgba(0,255,136,0.4)' : '#B8885A'}`,
              color:      saved ? '#00ff88' : '#fff',
              opacity:    saving ? 0.7 : 1,
            }}
          >
            {saved ? 'Desat' : saving ? 'Desant...' : 'Desar preferències'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
