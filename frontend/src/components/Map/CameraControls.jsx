import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useMapStore } from '../../store/mapStore'

export default function CameraControls() {
  const { bearing, rotateBearing } = useMapStore()
  const [hovered, setHovered] = useState(false)

  const bearingDeg = Math.round(((bearing % 360) + 360) % 360)

  const resetNorth = () => {
    const current = ((bearing % 360) + 360) % 360
    const delta   = current > 180 ? 360 - current : -current
    rotateBearing(delta)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.2, duration: 0.4 }}
      className="absolute left-4 bottom-8 select-none z-30"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative flex items-center gap-1.5">
        {/* Rotate left — visible on hover */}
        <motion.button
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : 6 }}
          transition={{ duration: 0.15 }}
          onClick={() => rotateBearing(-22.5)}
          className="w-7 h-7 flex items-center justify-center rounded-lg font-mono text-[13px] transition-colors"
          style={{ background: '#141414', border: '1px solid #262626', color: '#555' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#EBEBEB' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
          title="Girar esquerra"
        >⟲</motion.button>

        {/* Compass button */}
        <button
          onClick={resetNorth}
          title={bearingDeg !== 0 ? `Restablir nord (${bearingDeg}°)` : 'Nord'}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-all"
          style={{
            background: '#141414',
            border: `1px solid ${bearingDeg !== 0 ? '#B8885A55' : '#262626'}`,
            boxShadow: bearingDeg !== 0 ? '0 0 8px rgba(184,136,90,0.2)' : 'none',
          }}
        >
          <svg
            width="22" height="22" viewBox="0 0 34 34"
            style={{ transform: `rotate(${-bearingDeg}deg)`, transition: 'transform 0.3s ease' }}
          >
            <circle cx="17" cy="17" r="15" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
            <polygon points="17,3 14,17 17,14 20,17"  fill="rgba(0,210,255,0.9)" />
            <polygon points="17,31 14,17 17,20 20,17" fill="rgba(255,255,255,0.18)" />
            <circle cx="17" cy="17" r="1.5" fill="rgba(255,255,255,0.35)" />
          </svg>
        </button>

        {/* Rotate right — visible on hover */}
        <motion.button
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : -6 }}
          transition={{ duration: 0.15 }}
          onClick={() => rotateBearing(22.5)}
          className="w-7 h-7 flex items-center justify-center rounded-lg font-mono text-[13px] transition-colors"
          style={{ background: '#141414', border: '1px solid #262626', color: '#555' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#EBEBEB' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
          title="Girar dreta"
        >⟳</motion.button>
      </div>
    </motion.div>
  )
}
