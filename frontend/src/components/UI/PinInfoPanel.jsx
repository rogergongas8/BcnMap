import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePinStore } from '../../store/pinStore'
import { useMapStore } from '../../store/mapStore'
import { useRouteStore } from '../../store/routeStore'

export default function PinInfoPanel() {
  const pin = usePinStore(s => s.pin)
  const clearPin = usePinStore(s => s.clearPin)
  const userLocation = useMapStore(s => s.userLocation)

  const startRouteHere = () => {
    if (!pin) return
    const origin = userLocation
      ? { ...userLocation, label: 'Mi ubicación' }
      : null
    const destination = { lat: pin.lat, lng: pin.lng, label: pin.main || 'Ubicación' }
    const store = useRouteStore.getState()
    store.setMode('foot')
    if (origin) store.setOrigin(origin)
    store.setDestination(destination)
    store.setChatRequest({ origin, destination, mode: 'foot', route: null })
    clearPin()
  }

  return (
    <AnimatePresence>
      {pin && (
        <motion.div
          key="pin-panel"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-[320px]
            rounded-2xl overflow-hidden
            bg-black/90 backdrop-blur-xl border border-white/[0.08]
            shadow-[0_0_40px_rgba(0,0,0,0.6),0_0_20px_rgba(34,211,238,0.08)]"
        >
          <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

          <div className="px-4 py-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
                <span className="text-cyan-300/70 text-[10px] font-mono tracking-[0.15em] uppercase truncate">
                  {pin.loading ? 'Localizando…' : 'Punto seleccionado'}
                </span>
              </div>
              <button
                onClick={clearPin}
                className="text-white/25 hover:text-white/70 transition-colors w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/[0.05] text-base leading-none flex-shrink-0"
                aria-label="Cerrar"
              >×</button>
            </div>

            <div className="text-white text-[15px] font-medium leading-tight mb-0.5 truncate">
              {pin.main}
            </div>
            {pin.sub && (
              <div className="text-white/45 text-xs truncate">
                {pin.sub}
              </div>
            )}
            <div className="text-white/25 text-[10px] font-mono mt-1.5">
              {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </div>
          </div>

          <div className="flex items-stretch gap-px bg-white/[0.04]">
            <button
              onClick={startRouteHere}
              disabled={pin.loading}
              className="flex-1 px-3 py-2.5 text-xs font-mono tracking-wide
                bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200
                transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-1.5"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M2 8h12M9 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Ruta hasta aquí
            </button>
            <button
              onClick={() => {
                if (navigator.clipboard && pin) {
                  navigator.clipboard.writeText(`${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}`)
                }
              }}
              className="px-3 py-2.5 text-xs font-mono text-white/45 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
              title="Copiar coordenadas"
            >
              copiar
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
