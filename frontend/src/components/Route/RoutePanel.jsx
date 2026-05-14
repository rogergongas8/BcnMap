import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouteStore } from '../../store/routeStore'
import { useRoute } from '../../hooks/useRoute'

const MODES = [
  { id: 'foot', label: 'A pie',   icon: '↑' },
  { id: 'bike', label: 'Bicing',  icon: '⬡' },
  { id: 'car',  label: 'Coche',   icon: '▷' },
  { id: 'bus',  label: 'Bus',     icon: '⬛' },
]

function fmtDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function fmtTime(s) {
  const min = Math.round(s / 60)
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}min` : `${min} min`
}

function PointRow({ label, value, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
        ${active ? 'bg-cyan-500/15 border border-cyan-500/40' : 'bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07]'}`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-cyan-400 animate-pulse' : 'bg-white/25'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-white/35 font-mono uppercase tracking-wider">{label}</p>
        <p className={`text-xs font-mono truncate ${value ? 'text-white/80' : 'text-white/30'}`}>
          {active ? 'Haz clic en el mapa...' : (value?.label ?? 'Seleccionar')}
        </p>
      </div>
    </button>
  )
}

export default function RoutePanel() {
  useRoute()
  const {
    isOpen, togglePanel, closePanel,
    mode, setMode,
    origin, destination, picking, setPicking,
    setOrigin, setDestination,
    route, isLoading, error, clearRoute,
  } = useRouteStore()

  return (
    <>
      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="route-panel"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-40
              w-[300px] panel-glass rounded-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
              <span className="text-white/70 text-xs font-mono tracking-wider">RUTA</span>
              <button
                onClick={closePanel}
                className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
              >×</button>
            </div>

            {/* Mode selector */}
            <div className="grid grid-cols-4 gap-px bg-white/[0.04] border-b border-white/[0.06]">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`py-2 text-[10px] font-mono transition-colors flex flex-col items-center gap-0.5
                    ${mode === m.id ? 'text-cyan-400 bg-cyan-500/10' : 'text-white/35 hover:text-white/65 bg-transparent'}`}
                >
                  <span className="text-sm leading-none">{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Points */}
            <div className="flex flex-col gap-2 p-3">
              <PointRow
                label="Origen"
                value={origin}
                active={picking === 'origin'}
                onClick={() => {
                  setOrigin(null)
                  setPicking(picking === 'origin' ? null : 'origin')
                }}
              />
              <div className="flex items-center gap-2 px-1">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <button
                  onClick={() => {
                    const tmp = origin
                    setOrigin(destination)
                    setDestination(tmp)
                  }}
                  className="text-white/20 hover:text-white/50 transition-colors text-xs font-mono"
                  title="Intercambiar origen y destino"
                >⇅</button>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <PointRow
                label="Destino"
                value={destination}
                active={picking === 'destination'}
                onClick={() => {
                  setDestination(null)
                  setPicking(picking === 'destination' ? null : 'destination')
                }}
              />
            </div>

            {/* Result / status */}
            {(isLoading || route || error) && (
              <div className="px-3 pb-3">
                {isLoading && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04]">
                    <span className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-xs text-white/35 font-mono ml-1">Calculando...</span>
                  </div>
                )}
                {!isLoading && error && (
                  <p className="text-xs text-red-400/80 font-mono px-1">{error}</p>
                )}
                {!isLoading && route && (
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-cyan-500/8 border border-cyan-500/20">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                      <span className="text-cyan-300 text-sm font-mono font-medium">{fmtTime(route.duration)}</span>
                    </div>
                    <span className="text-white/40 text-xs font-mono">{fmtDist(route.distance)}</span>
                    <button
                      onClick={clearRoute}
                      className="text-white/25 hover:text-white/60 transition-colors text-xs font-mono"
                    >✕</button>
                  </div>
                )}
              </div>
            )}

            {/* Hint when no points yet */}
            {!origin && !destination && !picking && (
              <p className="text-center text-white/20 text-[10px] font-mono pb-3 px-4">
                Haz clic en "Origen" y luego en el mapa
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
