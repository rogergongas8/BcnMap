import React from 'react'
import { motion } from 'framer-motion'
import { useDataStore } from '../../store/dataStore'
import { useChatStore } from '../../store/chatStore'

function fmtTime(date) {
  if (!date) return '—'
  return date.toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' })
}

function StatusDot({ color = '#34d399' }) {
  return (
    <span className="relative inline-flex w-1.5 h-1.5">
      <span className="absolute inset-0 rounded-full animate-ping opacity-50" style={{ background: color }} />
      <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: color }} />
    </span>
  )
}

export default function CityHud() {
  const weather    = useDataStore(s => s.weather)
  const airQuality = useDataStore(s => s.airQuality)
  const traffic    = useDataStore(s => s.traffic)
  const bicing     = useDataStore(s => s.bicing)
  const lastUpdated = useDataStore(s => s.lastUpdated)
  const chatOpen   = useChatStore(s => s.isOpen)

  const congested = traffic.filter(t => ['congestionado', 'cortado'].includes(t.estado)).length
  const congestionPct = traffic.length ? Math.round((congested / traffic.length) * 100) : null

  const activeBicing = bicing.filter(s => s.status === 'active')
  const totalBikes   = activeBicing.reduce((a, s) => a + s.bikes_available, 0)

  const aqiColor = !airQuality ? '#94a3b8'
    : airQuality.aqi <= 50  ? '#34d399'
    : airQuality.aqi <= 100 ? '#fbbf24'
    : '#fb7185'

  const congColor = congestionPct == null ? '#94a3b8'
    : congestionPct < 15 ? '#34d399'
    : congestionPct < 35 ? '#fbbf24'
    : '#fb7185'

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0, x: chatOpen ? -356 : 0 }}
      transition={{ delay: chatOpen ? 0 : 0.4, duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="absolute top-4 right-4 z-30 w-[260px] rounded-2xl
        bg-[#0a0c10]/85 backdrop-blur-2xl border border-white/[0.07]
        shadow-[0_0_40px_rgba(0,0,0,0.4)] overflow-hidden"
    >
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <StatusDot color="#34d399" />
          <span className="text-white/85 text-[11px] font-medium tracking-[0.12em] uppercase">
            BCN · Live
          </span>
        </div>
        <span className="text-white/30 text-[10px] tabular-nums">{fmtTime(lastUpdated)}</span>
      </div>

      <div className="px-4 py-3 flex items-end justify-between gap-3 border-b border-white/[0.04]">
        <div className="flex items-baseline gap-2">
          <span className="text-white text-[32px] leading-none font-light tabular-nums">
            {weather?.temp != null ? Math.round(weather.temp) : '—'}
            <span className="text-white/40 text-[16px]">°</span>
          </span>
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="text-white/75 text-[11px] capitalize leading-snug truncate">
            {weather?.description ?? 'Cargando…'}
          </p>
          {weather?.wind_speed != null && (
            <p className="text-white/35 text-[10px] mt-0.5 tabular-nums">
              {Math.round(weather.wind_speed)} m/s viento
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-white/[0.04]">
        <div className="px-3 py-2.5 text-center">
          <p className="text-white/35 text-[9px] uppercase tracking-wider mb-0.5">AQI</p>
          <p className="text-[13px] tabular-nums font-medium" style={{ color: aqiColor }}>
            {airQuality?.aqi ?? '—'}
          </p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="text-white/35 text-[9px] uppercase tracking-wider mb-0.5">Tránsit</p>
          <p className="text-[13px] tabular-nums font-medium" style={{ color: congColor }}>
            {congestionPct != null ? `${congestionPct}%` : '—'}
          </p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="text-white/35 text-[9px] uppercase tracking-wider mb-0.5">Bicis</p>
          <p className="text-white/85 text-[13px] tabular-nums font-medium">
            {totalBikes > 0 ? totalBikes : '—'}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
