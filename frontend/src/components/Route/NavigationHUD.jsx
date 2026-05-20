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
        <div className="rounded-2xl bg-[#0a0c10]/95 border border-white/[0.09] shadow-[0_8px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl overflow-hidden">

          {/* Off-route warning */}
          <AnimatePresence>
            {offRoute && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2"
              >
                <span className="text-amber-400 text-sm">⚠</span>
                <span className="text-amber-300/80 text-[11px] font-mono">Fuera de ruta</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Current step */}
          <div className="px-4 py-3 flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)' }}
            >
              <span style={{ color: '#22d3ee' }}>{arrow}</span>
            </div>

            <div className="flex-1 min-w-0">
              {isLast ? (
                <>
                  <p className="text-white text-[14px] font-medium leading-snug">Has llegado a tu destino</p>
                  {destination?.label && (
                    <p className="text-white/50 text-[11px] font-mono mt-0.5 truncate">{destination.label}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-white text-[14px] font-medium leading-snug line-clamp-2">
                    {step?.instruction ?? 'Continúa recto'}
                  </p>
                  {step?.distance > 0 && (
                    <p className="text-cyan-400/70 text-[12px] font-mono mt-0.5">
                      en {fmtDist(step.distance)}
                    </p>
                  )}
                </>
              )}
            </div>

            <button
              onClick={stopNavigation}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30
                hover:text-white/70 hover:bg-white/[0.06] transition-colors flex-shrink-0 text-lg"
            >
              ×
            </button>
          </div>

          {/* Next step + total remaining */}
          {!isLast && (
            <div className="px-4 py-2.5 border-t border-white/[0.05] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                {next && (
                  <>
                    <span className="text-white/25 text-xs flex-shrink-0">después</span>
                    <span className="text-white/45 text-[11px] font-mono truncate">{next.instruction}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-white/30 text-[10px] font-mono">{fmtDist(totalLeft)}</span>
                <span className="text-white/20 text-[10px]">·</span>
                <span className="text-white/30 text-[10px] font-mono">
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
