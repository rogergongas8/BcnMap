import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDataStore } from '../../store/dataStore'
import { useChatStore } from '../../store/chatStore'
import { useTimeStore } from '../../store/timeStore'

const C = {
  orange: '#E8622A',
  blue:   '#4D84D4',
  green:  '#3CB887',
  amber:  '#C98E2E',
  red:    '#D45555',
}

function fmtTime(date) {
  if (!date) return '—'
  return date.toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(date) {
  if (!date) return ''
  return date.toLocaleDateString('ca', { day: 'numeric', month: 'short' })
}

function DataBar({ pct, color }) {
  return (
    <div className="h-[2px] w-full rounded-full" style={{ background: '#262626' }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
      />
    </div>
  )
}

function DataRow({ label, value, sub, pct, color }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.12em]" style={{ color: '#555' }}>
          {label}
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[12px] font-mono font-medium" style={{ color }}>
            {value}
          </span>
          {sub && (
            <span className="text-[10px] font-mono" style={{ color: '#555' }}>
              {sub}
            </span>
          )}
        </div>
      </div>
      <DataBar pct={pct} color={color} />
    </div>
  )
}

/* ── Expanded card (variant B) ─────────────────────────────────────── */
function HudExpanded({ weather, airQuality, traffic, bicing, now, onCollapse }) {
  const congested     = traffic.filter(t => ['congestionado', 'cortado'].includes(t.estado)).length
  const congestionPct = traffic.length ? Math.round((congested / traffic.length) * 100) : 0

  const activeBicing  = bicing.filter(s => s.status === 'active')
  const totalBikes    = activeBicing.reduce((a, s) => a + s.bikes_available + s.ebikes_available, 0)
  const totalDocks    = activeBicing.reduce((a, s) => a + s.docks_available, 0)
  const bicingPct     = (totalBikes + totalDocks) > 0 ? Math.round((totalBikes / (totalBikes + totalDocks)) * 100) : 0

  const aqi     = airQuality?.aqi ?? null
  const aqiPct  = aqi ? Math.min(100, (aqi / 200) * 100) : 0
  const aqiColor = !aqi ? C.blue : aqi <= 50 ? C.green : aqi <= 100 ? C.amber : C.red
  const aqiLabel = !aqi ? '—' : aqi <= 50 ? 'Bona' : aqi <= 100 ? 'Moderada' : 'Dolenta'

  const congColor = congestionPct < 15 ? C.green : congestionPct < 40 ? C.amber : C.red
  const congLabel = congestionPct < 15 ? 'Fluid' : congestionPct < 40 ? 'Moderat' : 'Dens'

  return (
    <div className="panel w-[260px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      {/* Header */}
      <button
        onClick={onCollapse}
        className="w-full flex items-center justify-between px-3.5 py-2.5 border-b border-[#262626] hover:bg-[#1a1a1a] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3CB887] animate-pulse" />
          <span className="font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: '#555' }}>
            Barcelona · Temps real
          </span>
        </div>
        <span className="font-mono text-[9px]" style={{ color: '#555' }}>
          {fmtDate(now)} · {fmtTime(now)}
        </span>
      </button>

      {/* Temperature */}
      <div className="px-3.5 py-3 border-b border-[#1a1a1a]">
        <div className="flex items-end gap-3">
          <div className="flex items-baseline gap-0.5">
            <span className="font-syne text-[34px] leading-none font-light" style={{ color: '#EBEBEB' }}>
              {weather?.temp != null ? Math.round(weather.temp) : '—'}
            </span>
            <span className="font-mono text-[14px] leading-none" style={{ color: '#555' }}>°C</span>
          </div>
          <div className="flex-1 min-w-0 pb-0.5">
            <p className="font-syne text-[11px] leading-snug capitalize truncate" style={{ color: '#888' }}>
              {weather?.description ?? '—'}
            </p>
            {(weather?.temp_min != null || weather?.wind_speed != null) && (
              <p className="font-mono text-[9px] mt-0.5 tracking-wide" style={{ color: '#555' }}>
                {weather.temp_min != null && `+${Math.round(weather.temp_min)}° `}
                {weather.temp_max != null && `+${Math.round(weather.temp_max)}° `}
                {weather.wind_speed != null && `${Math.round(weather.wind_speed)} km/h`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Data rows */}
      <div className="px-3.5 py-3 space-y-3">
        <DataRow
          label="Qualitat de l'aire"
          value={aqiLabel}
          sub={aqi ? `${aqi} AQI` : null}
          pct={aqiPct}
          color={aqiColor}
        />
        <DataRow
          label="Congestió trànsit"
          value={congLabel}
          sub={`${congestionPct}%`}
          pct={congestionPct}
          color={congColor}
        />
        <DataRow
          label="Bicing disponible"
          value={totalBikes > 0 ? totalBikes.toLocaleString('ca') : '—'}
          sub={totalBikes > 0 ? `bicis · ${bicingPct}%` : null}
          pct={bicingPct}
          color={C.orange}
        />
      </div>
    </div>
  )
}

/* ── Compact pills (variant C) ─────────────────────────────────────── */
function HudPills({ weather, airQuality, traffic, bicing, onExpand }) {
  const congested     = traffic.filter(t => ['congestionado', 'cortado'].includes(t.estado)).length
  const congestionPct = traffic.length ? Math.round((congested / traffic.length) * 100) : 0

  const activeBicing  = bicing.filter(s => s.status === 'active')
  const totalBikes    = activeBicing.reduce((a, s) => a + s.bikes_available + s.ebikes_available, 0)

  const aqi      = airQuality?.aqi ?? null
  const aqiColor = !aqi ? C.blue : aqi <= 50 ? C.green : aqi <= 100 ? C.amber : C.red
  const congColor = congestionPct < 15 ? C.green : congestionPct < 40 ? C.amber : C.red

  return (
    <button
      onClick={onExpand}
      className="flex items-center gap-2 hover:opacity-90 transition-opacity"
    >
      {/* Weather pill */}
      <div className="panel px-3 py-1.5 flex items-center gap-2 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#3CB887] animate-pulse flex-shrink-0" />
        <span className="font-syne text-[13px] font-medium" style={{ color: '#EBEBEB' }}>
          {weather?.temp != null ? `${Math.round(weather.temp)}°` : '—'}
        </span>
        <span className="font-syne text-[11px]" style={{ color: '#888' }}>
          {weather?.description ?? '—'}
        </span>
      </div>

      {/* Stat pills */}
      <div className="flex gap-1.5">
        {[
          { label: 'AQI', value: aqi ?? '—', color: aqiColor },
          { label: 'Trànsit', value: `${congestionPct}%`, color: congColor },
          { label: 'Bicis', value: totalBikes > 0 ? `${(totalBikes / 1000).toFixed(1)}k` : '—', color: C.orange },
        ].map(({ label, value, color }) => (
          <div key={label} className="panel px-2.5 py-1.5 text-center rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
            <p className="font-mono text-[8px] uppercase tracking-[0.1em] mb-0.5" style={{ color: '#555' }}>{label}</p>
            <p className="font-mono text-[12px] font-medium leading-none" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>
    </button>
  )
}

/* ── Main ──────────────────────────────────────────────────────────── */
export default function CityHud() {
  const weather     = useDataStore(s => s.weather)
  const airQuality  = useDataStore(s => s.airQuality)
  const traffic     = useDataStore(s => s.traffic)
  const bicing      = useDataStore(s => s.bicing)
  const lastUpdated = useDataStore(s => s.lastUpdated)
  const chatOpen    = useChatStore(s => s.isOpen)
  const isHistorical = useTimeStore(s => s.isHistorical)

  const [compact, setCompact] = useState(false)

  const now = lastUpdated ?? new Date()

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0, x: chatOpen ? -356 : 0 }}
      transition={{ delay: chatOpen ? 0 : 0.3, duration: 0.26, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="absolute top-4 right-4 z-30"
    >
      {isHistorical && (
        <div className="mb-2 flex justify-end">
          <div className="panel px-3 py-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.amber }} />
            <span className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: C.amber }}>
              Mode Històric
            </span>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {compact ? (
          <motion.div key="pills"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
          >
            <HudPills
              weather={weather}
              airQuality={airQuality}
              traffic={traffic}
              bicing={bicing}
              onExpand={() => setCompact(false)}
            />
          </motion.div>
        ) : (
          <motion.div key="expanded"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
          >
            <HudExpanded
              weather={weather}
              airQuality={airQuality}
              traffic={traffic}
              bicing={bicing}
              now={now}
              onCollapse={() => setCompact(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
