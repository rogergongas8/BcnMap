import React, { useRef } from 'react'
import { motion } from 'framer-motion'
import { useMapStore } from '../../store/mapStore'
import { useChatStore } from '../../store/chatStore'

const BCN_CENTER = { lat: 41.3851, lng: 2.1734, zoom: 13 }

function GeoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="1.8" fill="currentColor"/>
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1"/>
      <line x1="6" y1="0" x2="6" y2="1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <line x1="6" y1="10.5" x2="6" y2="12" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <line x1="0" y1="6" x2="1.5" y2="6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <line x1="10.5" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}

export default function MapControls() {
  const { flyTo, togglePitch, toggleBuildings, pitch, showBuildings3D, mapTheme, mapInstance } = useMapStore()
  const chatOpen = useChatStore(s => s.isOpen)
  // Track whether the component has already animated in — after that, no intro delay
  const hasAnimatedIn = useRef(false)
  const is3D             = pitch > 10
  const canToggleBuildings = mapTheme !== 'minimal'

  function geolocate() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapInstance?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 16, duration: 1400 })
      },
      () => {},
      { timeout: 8000 }
    )
  }

  // Once the intro delay fires, mark as animated so subsequent transitions are instant
  const introDelay = hasAnimatedIn.current ? 0 : 4.1

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: chatOpen ? -340 : 0 }}
      transition={{ delay: introDelay, duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
      onAnimationComplete={() => { hasAnimatedIn.current = true }}
      className="absolute right-4 bottom-8 select-none"
    >
      <div className="panel-glass rounded-xl flex flex-col gap-0 overflow-hidden w-[52px]">
        <button
          onClick={togglePitch}
          title={is3D ? 'Vista cenital' : 'Vista 3D'}
          className={`w-full py-2.5 text-[11px] font-mono transition-colors
            ${is3D ? 'text-white bg-white/8 hover:bg-white/12' : 'text-white/45 hover:text-white/80'}`}
        >
          {is3D ? '2D' : '3D'}
        </button>

        {canToggleBuildings && (
          <button
            onClick={toggleBuildings}
            title={showBuildings3D ? 'Ocultar edificios' : 'Mostrar edificios 3D'}
            className={`w-full py-2.5 text-[11px] font-mono transition-colors border-t border-white/[0.06]
              ${showBuildings3D ? 'text-white bg-white/8 hover:bg-white/12' : 'text-white/45 hover:text-white/80'}`}
          >
            EDI
          </button>
        )}

        <button
          onClick={() => flyTo(BCN_CENTER)}
          title="Centrar en Barcelona"
          className="w-full py-2.5 text-[11px] font-mono text-white/45 hover:text-white/80 transition-colors border-t border-white/[0.06]"
        >
          BCN
        </button>

        <button
          onClick={geolocate}
          title="Mi ubicación"
          className="w-full py-2.5 flex items-center justify-center text-white/45 hover:text-cyan-400 transition-colors border-t border-white/[0.06]"
        >
          <GeoIcon />
        </button>
      </div>
    </motion.div>
  )
}
