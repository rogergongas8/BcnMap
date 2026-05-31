import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTimeStore } from '../../store/timeStore'
import { useDataStore } from '../../store/dataStore'
import { useRouteStore } from '../../store/routeStore'
import { fetchTraffic, fetchBicing } from '../../services/api'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/v1'

function formatAt(iso) {
  if (!iso) return ''
  const d   = new Date(iso)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dStart     = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const time = `${hh}:${mm}`
  const diffDays = Math.round((todayStart - dStart) / 86400000)
  if (diffDays === 0) return `Avui ${time}`
  if (diffDays === 1) return `Ahir ${time}`
  return `Fa ${diffDays}d ${time}`
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function HistorySlider() {
  const { isHistorical, selectedAt, range, setRange, setHistorical, setLive } = useTimeStore()
  const { setTraffic, setBicing } = useDataStore()
  const isNavigating = useRouteStore(s => s.isNavigating)

  const [isOpen, setIsOpen]   = useState(false)
  const [value,   setValue]   = useState(100)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    fetch(`${BASE}/history/range`)
      .then(r => r.json())
      .then(data => { if (data.earliest && data.latest) setRange(data) })
      .catch(() => {})
  }, [])

  // Auto-open when entering historical mode from outside (e.g. AI action)
  useEffect(() => {
    if (isHistorical) setIsOpen(true)
  }, [isHistorical])

  const loadSnapshot = useCallback(async (at) => {
    setLoading(true)
    try {
      const res  = await fetch(`${BASE}/history/snapshot?at=${encodeURIComponent(at)}`)
      const snap = await res.json()
      if (snap.traffic) setTraffic(snap.traffic)
      if (snap.bicing)  setBicing(snap.bicing)
      setHistorical(at)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [setTraffic, setBicing, setHistorical])

  const handleSliderChange = (e) => {
    const pct = Number(e.target.value)
    setValue(pct)
    if (!range?.earliest || !range?.latest) return
    const earliest = new Date(range.earliest).getTime()
    const latest   = new Date(range.latest).getTime()
    const at = new Date(earliest + (pct / 100) * (latest - earliest)).toISOString()
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadSnapshot(at), 280)
  }

  const handleLive = useCallback(async () => {
    setLive()
    setValue(100)
    setLoading(true)
    try {
      const [traffic, bicing] = await Promise.allSettled([fetchTraffic(), fetchBicing()])
      if (traffic.status === 'fulfilled') setTraffic(traffic.value)
      if (bicing.status  === 'fulfilled') setBicing(bicing.value)
    } finally {
      setLoading(false)
    }
  }, [setLive, setTraffic, setBicing])

  const handleClose = () => {
    setIsOpen(false)
    if (isHistorical) handleLive()
  }

  const displayAt = isHistorical && selectedAt ? formatAt(selectedAt) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`absolute ${isNavigating ? 'bottom-[200px]' : 'bottom-4'} left-1/2 -translate-x-1/2 z-40`}
    >
      <AnimatePresence mode="wait">
        {!isOpen ? (
          /* ── Collapsed: clock pill ── */
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18 }}
            onClick={() => setIsOpen(true)}
            className="panel flex items-center gap-2 px-3 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-opacity hover:opacity-80"
            title="Veure dades històriques"
          >
            <ClockIcon />
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                background: '#3CB887',
                boxShadow: '0 0 6px #3CB887',
                animation: 'hsPulse 1.8s ease-in-out infinite',
              }}
            />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: '#3CB887' }}>
              Temps real
            </span>
          </motion.button>
        ) : (
          /* ── Expanded: full slider ── */
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="panel flex items-center gap-3 px-3 py-2.5 shadow-[0_4px_24px_rgba(0,0,0,0.55)]"
            style={{ minWidth: 340, maxWidth: 480 }}
          >
            {/* Live button */}
            <button
              onClick={handleLive}
              className="flex items-center gap-1.5 px-2.5 py-1.5 flex-shrink-0 transition-all"
              style={{
                borderRadius: 6,
                border: `1px solid ${!isHistorical ? '#3CB88744' : '#2C2926'}`,
                background: !isHistorical ? '#3CB88718' : '#211F1B',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  background: !isHistorical ? '#3CB887' : '#8C8884',
                  boxShadow: !isHistorical ? '0 0 6px #3CB887' : 'none',
                  animation: !isHistorical ? 'hsPulse 1.8s ease-in-out infinite' : 'none',
                }}
              />
              <span
                className="font-mono text-[9px] uppercase tracking-[0.14em]"
                style={{ color: !isHistorical ? '#3CB887' : '#8C8884' }}
              >
                Live
              </span>
            </button>

            {/* Slider section */}
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center justify-center h-3.5">
                {loading ? (
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: '#C98E2E' }}>
                    Carregant…
                  </span>
                ) : isHistorical && displayAt ? (
                  <span className="font-mono text-[9px]" style={{ color: '#C98E2E' }}>{displayAt}</span>
                ) : null}
              </div>

              <div className="relative flex items-center">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={value}
                  onChange={handleSliderChange}
                  className="w-full h-[3px] appearance-none cursor-pointer rounded-full outline-none"
                  style={{
                    background: `linear-gradient(to right, #B8885A ${value}%, #2C2926 ${value}%)`,
                  }}
                />
              </div>

              <div className="flex justify-between">
                <span className="font-mono text-[9px]" style={{ color: '#8C8884' }}>
                  {range?.earliest ? formatAt(range.earliest) : '–24h'}
                </span>
                <span className="font-mono text-[9px]" style={{ color: '#8C8884' }}>Ara</span>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors"
              style={{ color: '#8C8884' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#B0ACA7' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#8C8884' }}
              title="Tancar"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 13px; height: 13px;
          border-radius: 50%;
          background: #B8885A;
          box-shadow: 0 0 0 2px #151210, 0 0 8px #B8885A80;
          cursor: pointer;
          transition: transform 0.15s;
        }
        input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.2); }
        input[type=range]::-moz-range-thumb {
          width: 13px; height: 13px;
          border-radius: 50%;
          background: #B8885A;
          box-shadow: 0 0 0 2px #151210, 0 0 8px #B8885A80;
          border: none;
          cursor: pointer;
        }
        @keyframes hsPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </motion.div>
  )
}
