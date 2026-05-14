import React from 'react'
import { motion } from 'framer-motion'
import { useMapStore } from '../../store/mapStore'

export default function CameraControls() {
  const { bearing, pitch, rotateBearing, adjustPitch } = useMapStore()

  const bearingDeg = Math.round(((bearing % 360) + 360) % 360)
  const pitchDeg   = Math.round(Math.max(0, Math.min(65, pitch)))

  const resetNorth = () => {
    const current = ((bearing % 360) + 360) % 360
    const delta   = current > 180 ? 360 - current : -current
    rotateBearing(delta)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 4, duration: 0.4 }}
      className="absolute left-4 top-1/2 -translate-y-1/2 select-none"
    >
      <div className="panel-glass rounded-xl flex flex-col gap-0 overflow-hidden w-[88px]">

        <section className="flex flex-col items-center gap-1.5 px-2 pt-3 pb-2.5">
          <span className="text-white/25 text-[8px] font-mono tracking-widest uppercase">Bearing</span>

          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => rotateBearing(-22.5)}
              className="text-white/35 hover:text-white/80 w-5 h-5 flex items-center justify-center rounded transition-colors text-sm"
            >⟲</button>

            <button onClick={resetNorth} title="Resetear norte" className="flex items-center justify-center">
              <svg
                width="34" height="34" viewBox="0 0 34 34"
                style={{ transform: `rotate(${-bearingDeg}deg)`, transition: 'transform 0.3s ease' }}
              >
                <circle cx="17" cy="17" r="15" stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none" />
                <polygon points="17,3 14,17 17,14 20,17"  fill="rgba(0,210,255,0.9)" />
                <polygon points="17,31 14,17 17,20 20,17" fill="rgba(255,255,255,0.18)" />
                <circle cx="17" cy="17" r="1.5" fill="rgba(255,255,255,0.4)" />
              </svg>
            </button>

            <button
              onClick={() => rotateBearing(22.5)}
              className="text-white/35 hover:text-white/80 w-5 h-5 flex items-center justify-center rounded transition-colors text-sm"
            >⟳</button>
          </div>

          <span className="text-white/30 text-[9px] font-mono tabular-nums">{bearingDeg}°</span>
        </section>

        <div className="h-px bg-white/[0.06] mx-2" />

        <section className="flex flex-col items-center gap-1.5 px-2 pt-2.5 pb-3">
          <span className="text-white/25 text-[8px] font-mono tracking-widest uppercase">Pitch</span>

          <div className="flex items-center gap-1.5 w-full">
            <button
              onClick={() => adjustPitch(-10)}
              className="text-white/35 hover:text-white/80 w-5 h-5 flex items-center justify-center text-[10px] transition-colors flex-shrink-0"
            >▼</button>

            <div className="flex-1 h-[3px] bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(pitchDeg / 65) * 100}%`,
                  background: 'linear-gradient(to right, rgba(0,180,255,0.5), rgba(0,210,255,0.9))',
                }}
              />
            </div>

            <button
              onClick={() => adjustPitch(10)}
              className="text-white/35 hover:text-white/80 w-5 h-5 flex items-center justify-center text-[10px] transition-colors flex-shrink-0"
            >▲</button>
          </div>

          <span className="text-white/30 text-[9px] font-mono tabular-nums">{pitchDeg}°</span>
        </section>

      </div>
    </motion.div>
  )
}
