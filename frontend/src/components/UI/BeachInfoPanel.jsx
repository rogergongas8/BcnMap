import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLeisureStore } from '../../store/leisureStore'
import { useMapStore } from '../../store/mapStore'
import { useRouteStore } from '../../store/routeStore'

const OCCUPANCY_LABEL = { low: 'Poca gente', medium: 'Moderada', high: 'Mucha gente' }
const OCCUPANCY_COLOR = { low: 'text-green-400', medium: 'text-yellow-400', high: 'text-red-400' }
const FLAG_LABEL = { green: 'Bandera verde', yellow: 'Bandera amarilla', red: 'Bandera roja' }
const FLAG_COLOR = { green: 'bg-green-500/15 text-green-300 border-green-500/30', yellow: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30', red: 'bg-red-500/15 text-red-300 border-red-500/30' }

export default function BeachInfoPanel() {
  const beach = useLeisureStore(s => s.selectedBeach)
  const clear = useLeisureStore(s => s.clearSelected)
  const userLocation = useMapStore(s => s.userLocation)

  const handleRoute = () => {
    if (!beach) return
    const { setDestination, setOrigin, setMode, setChatRequest } = useRouteStore.getState()
    const origin = userLocation ? { ...userLocation, label: 'Mi ubicación' } : null
    const destination = { lat: beach.lat, lng: beach.lng, label: `Playa ${beach.name}` }
    setMode('foot')
    if (origin) setOrigin(origin)
    setDestination(destination)
    setChatRequest({ origin, destination, mode: 'foot', route: null })
    clear()
  }

  return (
    <AnimatePresence>
      {beach && (
        <motion.div
          key="beach-panel"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[340px]
            rounded-2xl overflow-hidden
            bg-black/92 backdrop-blur-2xl border border-cyan-500/[0.15]
            shadow-[0_0_50px_rgba(0,0,0,0.7),0_0_28px_rgba(34,211,238,0.12)]"
        >
          <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-cyan-300/80 text-[10px] font-mono tracking-[0.15em] uppercase">
                Platja
              </span>
            </div>
            <button
              onClick={clear}
              className="text-white/25 hover:text-white/70 transition-colors w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/[0.05] text-base leading-none"
            >×</button>
          </div>

          <div className="px-4 py-3.5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-white text-lg font-medium leading-tight">{beach.name}</h3>
                <p className="text-white/40 text-[11px] font-mono mt-0.5">{beach.district} · {beach.length_m}m</p>
              </div>
              {beach.recommended && (
                <span className="px-2 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-[10px] font-mono whitespace-nowrap">
                  Recomendada
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="px-2.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <p className="text-white/40 text-[9px] font-mono uppercase tracking-wider mb-0.5">Aire</p>
                <p className="text-white text-sm font-mono">{beach.weather?.temp ?? '—'}°</p>
              </div>
              <div className="px-2.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <p className="text-white/40 text-[9px] font-mono uppercase tracking-wider mb-0.5">Agua</p>
                <p className="text-white text-sm font-mono">{beach.water_temp ?? '—'}°</p>
              </div>
              <div className="px-2.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <p className="text-white/40 text-[9px] font-mono uppercase tracking-wider mb-0.5">Aforo</p>
                <p className={`text-sm font-mono ${OCCUPANCY_COLOR[beach.occupancy_level]}`}>
                  {beach.occupancy_pct}%
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className={`px-2 py-1 rounded-md border text-[10px] font-mono ${FLAG_COLOR[beach.flag] ?? 'bg-white/5 text-white/50'}`}>
                {FLAG_LABEL[beach.flag] ?? beach.flag}
              </span>
              <span className="px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60 text-[10px] font-mono">
                {OCCUPANCY_LABEL[beach.occupancy_level]}
              </span>
              {beach.amenities?.includes('lifeguard') && (
                <span className="px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60 text-[10px] font-mono">socorrista</span>
              )}
              {beach.amenities?.includes('accessible') && (
                <span className="px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60 text-[10px] font-mono">accesible</span>
              )}
              {beach.amenities?.includes('wifi') && (
                <span className="px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60 text-[10px] font-mono">wifi</span>
              )}
            </div>

            <p className="text-white/30 text-[10px] font-mono leading-relaxed">
              {beach.flag_reason} · Aforo estimado
            </p>
          </div>

          <div className="flex items-stretch gap-px bg-white/[0.04]">
            <button
              onClick={handleRoute}
              className="flex-1 px-3 py-2.5 text-xs font-mono tracking-wide
                bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200
                transition-colors flex items-center justify-center gap-1.5"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M2 8h12M9 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Cómo llegar
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
