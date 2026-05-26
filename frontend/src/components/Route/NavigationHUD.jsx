import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouteStore } from '../../store/routeStore'
import { useNavigation } from '../../hooks/useNavigation'

// Valhalla maneuver type → direction arrow
const DIRECTION = {
  1: '↑', 2: '↗', 3: '↖',           // depart
  8: '↑', 22: '↑', 17: '↑',          // straight / continue
  9: '↗', 18: '↗', 23: '↗',          // slight right
  10: '→', 20: '→',                   // right
  11: '⤷', 25: '→', 37: '→',         // sharp right / merge
  12: '↺', 13: '↺',                   // U-turn
  14: '⤶', 38: '←',                   // sharp left
  15: '←', 19: '←', 21: '←', 24: '←',// left
  16: '↖',                            // slight left
  26: '⟳', 27: '↑',                   // roundabout
}

function fmtDist(m) {
  if (m == null) return ''
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
}

function fmtTime(s) {
  if (!s) return ''
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export default function NavigationHUD() {
  useNavigation()

  const {
    isNavigating, route, currentStepIndex,
    stopNavigation, offRoute, destination,
  } = useRouteStore()

  if (!isNavigating || !route) return null

  const seg   = route.segments?.[0]
  const steps = seg?.steps ?? []
  const step  = steps[currentStepIndex]
  const next  = steps[currentStepIndex + 1]

  const isLast    = currentStepIndex >= steps.length - 1
  const arrow     = step ? (DIRECTION[step.type] ?? '↑') : '⬤'
  const totalLeft = steps.slice(currentStepIndex).reduce((acc, s) => acc + (s.distance ?? 0), 0)

  return (
    <AnimatePresence>
      <motion.div
        key="nav-hud"
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 80 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[340px] max-w-[calc(100vw-32px)]"
      >
        <div className="overflow-hidden shadow-[0_4px_32px_rgba(0,0,0,0.6)]"
          style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8 }}
        >
          {/* Off-route warning */}
          <AnimatePresence>
            {offRoute && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-4 py-2 flex items-center gap-2"
                style={{ background: '#C98E2E18', borderBottom: '1px solid #C98E2E44' }}
              >
                <svg width="12" height="12" viewBox="0 0 10 10" fill="none" style={{ color: '#C98E2E', flexShrink: 0 }}><path d="M5 1L9.3 8.5H0.7L5 1Z" stroke="currentColor" strokeWidth="1" fill="none"/><line x1="5" y1="4" x2="5" y2="6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/><circle cx="5" cy="7.5" r="0.5" fill="currentColor"/></svg>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: '#C98E2E' }}>
                  Fora de ruta — recalculant
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Current step */}
          <div className="px-4 py-3.5 flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: '#1C1C1C', border: '1px solid #262626', color: '#E8622A' }}
            >
              {arrow}
            </div>

            <div className="flex-1 min-w-0">
              {isLast ? (
                <>
                  <p className="font-syne text-[14px] font-semibold leading-snug" style={{ color: '#EBEBEB' }}>
                    Has arribat al destí
                  </p>
                  {destination?.label && (
                    <p className="font-mono text-[10px] mt-0.5 truncate" style={{ color: '#555' }}>
                      {destination.label}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-syne text-[14px] font-semibold leading-snug line-clamp-2" style={{ color: '#EBEBEB' }}>
                    {step?.instruction ?? 'Continua recte'}
                  </p>
                  {step?.distance > 0 && (
                    <p className="font-mono text-[11px] mt-0.5" style={{ color: '#E8622A' }}>
                      en {fmtDist(step.distance)}
                    </p>
                  )}
                </>
              )}
            </div>

            <button
              onClick={stopNavigation}
              className="w-8 h-8 rounded-md flex items-center justify-center transition-colors flex-shrink-0 text-lg"
              style={{ background: '#1C1C1C', border: '1px solid #262626', color: '#555' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#D45555' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
            >
              ×
            </button>
          </div>

          {/* Next step + total remaining */}
          {!isLast && (
            <div className="px-4 py-2.5 flex items-center justify-between gap-4"
              style={{ borderTop: '1px solid #1A1A1A' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {next && (
                  <>
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] flex-shrink-0" style={{ color: '#555' }}>
                      després
                    </span>
                    <span className="font-mono text-[10px] truncate" style={{ color: '#888' }}>
                      {next.instruction}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="font-mono text-[10px]" style={{ color: '#555' }}>{fmtDist(totalLeft)}</span>
                <span style={{ color: '#333' }}>·</span>
                <span className="font-mono text-[10px]" style={{ color: '#555' }}>
                  {fmtTime(steps.slice(currentStepIndex).reduce((a, s) => a + (s.duration ?? 0), 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
