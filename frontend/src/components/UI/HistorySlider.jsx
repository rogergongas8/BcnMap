import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTimeStore } from '../../store/timeStore'
import { useDataStore } from '../../store/dataStore'
import { useRouteStore } from '../../store/routeStore'
import { fetchTraffic, fetchBicing } from '../../services/api'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/v1'

function formatAt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const time = `${hh}:${mm}`
  const diffDays = Math.round((todayStart - dStart) / 86400000)
  if (diffDays === 0) return `Hoy ${time}`
  if (diffDays === 1) return `Ayer ${time}`
  return `Hace ${diffDays}d ${time}`
}

export default function HistorySlider() {
  const { isHistorical, selectedAt, range, setRange, setHistorical, setLive } = useTimeStore()
  const { setTraffic, setBicing } = useDataStore()
  const isNavigating = useRouteStore(s => s.isNavigating)

  const [value, setValue] = useState(100)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    fetch(`${BASE}/history/range`)
      .then(r => r.json())
      .then(data => {
        if (data.earliest && data.latest) setRange(data)
      })
      .catch(() => {})
  }, [])

  const loadSnapshot = useCallback(async (at) => {
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/history/snapshot?at=${encodeURIComponent(at)}`)
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
    debounceRef.current = setTimeout(() => loadSnapshot(at), 300)
  }

  const handleLive = async () => {
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
  }

  const displayAt = isHistorical && selectedAt ? formatAt(selectedAt) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 0.3 }}
      className={`absolute ${isNavigating ? 'bottom-[192px]' : 'bottom-4'} left-1/2 -translate-x-1/2 z-40
        flex items-center gap-3 px-4 py-2.5 rounded-2xl
        bg-[#0a0c10]/90 backdrop-blur-2xl border border-white/[0.08]
        shadow-[0_0_40px_rgba(0,0,0,0.5)]`}
      style={{ minWidth: 320, maxWidth: 480 }}
    >
      {/* Live indicator / button */}
      <button
        onClick={handleLive}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold
          tracking-wider transition-all flex-shrink-0
          ${!isHistorical
            ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
            : 'text-white/40 hover:text-white/70 border border-white/[0.07] hover:border-white/[0.14]'
          }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${!isHistorical ? 'bg-emerald-400 shadow-[0_0_6px_#4ade80]' : 'bg-white/25'}`} />
        LIVE
      </button>

      {/* Slider */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {isHistorical && displayAt && (
          <p className="text-[10px] font-medium text-amber-400/90 text-center tracking-wide leading-none">
            {loading ? 'Cargando…' : displayAt}
          </p>
        )}
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={value}
            onChange={handleSliderChange}
            className="w-full h-1 appearance-none cursor-pointer rounded-full outline-none"
            style={{
              background: `linear-gradient(to right,
                #22d3ee ${value}%,
                rgba(255,255,255,0.1) ${value}%)`,
            }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-white/25 text-[9px]">{range?.earliest ? formatAt(range.earliest) : '24h'}</span>
          <span className="text-white/25 text-[9px]">Ahora</span>
        </div>
      </div>

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #22d3ee;
          box-shadow: 0 0 8px #22d3ee80;
          cursor: pointer;
        }
        input[type=range]::-moz-range-thumb {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #22d3ee;
          box-shadow: 0 0 8px #22d3ee80;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </motion.div>
  )
}
