import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useDataStore } from '../../store/dataStore'
import { useTimeStore } from '../../store/timeStore'

const C = {
  orange: '#B8885A',
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
    <div className="h-[2px] w-full rounded-full" style={{ background: '#2C2926' }}>
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
        <span className="text-[10px] font-mono uppercase tracking-[0.12em]" style={{ color: '#8C8884' }}>
          {label}
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[12px] font-mono font-medium" style={{ color }}>
            {value}
          </span>
          {sub && (
            <span className="text-[10px] font-mono" style={{ color: '#8C8884' }}>
              {sub}
            </span>
          )}
        </div>
      </div>
      <DataBar pct={pct} color={color} />
    </div>
  )
}

function ForecastStrip({ forecast }) {
  const { t } = useTranslation()
  if (!forecast?.length) return null

  return (
    <div className="px-3.5 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] mb-2.5" style={{ color: '#8C8884' }}>
        {t('weather.forecast')}
      </p>
      <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {forecast.slice(0, 8).map((slot, i) => {
          const iconPrefix = slot.icon?.slice(0, 2) ?? '01'
          const label = t(`weather.icon.${iconPrefix}`, { defaultValue: slot.description })
          return (
            <div
              key={slot.dt ?? i}
              className="flex flex-col items-center gap-1 flex-shrink-0 px-2 py-1.5 rounded-md"
              style={{ background: '#1A1816', minWidth: 44 }}
            >
              <span className="font-mono text-[9px]" style={{ color: '#8C8884' }}>{slot.time}</span>
              <span className="font-mono text-[11px] font-medium" style={{ color: '#F7F6F4' }}>{slot.temp}°</span>
              <span className="font-mono text-[8px] text-center leading-tight" style={{ color: '#6C6864' }}>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HudExpanded({ weather, airQuality, traffic, bicing, forecast, now }) {
  const { t } = useTranslation()
  const congested     = traffic.filter(tr => ['congestionado', 'cortado'].includes(tr.estado)).length
  const congestionPct = traffic.length ? Math.round((congested / traffic.length) * 100) : 0

  const activeBicing  = bicing.filter(s => s.status === 'active')
  const totalBikes    = activeBicing.reduce((a, s) => a + s.bikes_available + s.ebikes_available, 0)
  const totalDocks    = activeBicing.reduce((a, s) => a + s.docks_available, 0)
  const bicingPct     = (totalBikes + totalDocks) > 0 ? Math.round((totalBikes / (totalBikes + totalDocks)) * 100) : 0

  const aqi      = airQuality?.aqi ?? null
  const aqiPct   = aqi ? Math.min(100, (aqi / 200) * 100) : 0
  const aqiColor = !aqi ? C.blue : aqi <= 50 ? C.green : aqi <= 100 ? C.amber : C.red
  const aqiLabel = !aqi ? '—' : aqi <= 50 ? t('hud.aqiGood') : aqi <= 100 ? t('hud.aqiMod') : t('hud.aqiBad')

  const congColor = congestionPct < 15 ? C.green : congestionPct < 40 ? C.amber : C.red
  const congLabel = congestionPct < 15 ? t('hud.congFluid') : congestionPct < 40 ? t('hud.congMod') : t('hud.congDense')

  return (
    <div className="panel w-[260px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
      {/* Header */}
      <div className="w-full flex items-center justify-between px-3.5 py-2.5 border-b border-[#2C2926]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3CB887] animate-pulse" />
          <span className="font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: '#8C8884' }}>
            {t('hud.realtime')}
          </span>
        </div>
        <span className="font-mono text-[9px]" style={{ color: '#8C8884' }}>
          {fmtDate(now)} · {fmtTime(now)}
        </span>
      </div>

      {/* Temperature */}
      <div className="px-3.5 py-3 border-b border-[#201E1B]">
        <div className="flex items-end gap-3">
          <div className="flex items-baseline gap-0.5">
            <span className="font-syne text-[34px] leading-none font-light" style={{ color: '#F7F6F4' }}>
              {weather?.temp != null ? Math.round(weather.temp) : '—'}
            </span>
            <span className="font-mono text-[14px] leading-none" style={{ color: '#8C8884' }}>°C</span>
          </div>
          <div className="flex-1 min-w-0 pb-0.5">
            <p className="font-syne text-[11px] leading-snug capitalize" style={{ color: '#B0ACA7' }}>
              {weather?.description ?? '—'}
            </p>
            {(weather?.temp_min != null || weather?.wind_speed != null) && (
              <p className="font-mono text-[9px] mt-0.5 tracking-wide" style={{ color: '#8C8884' }}>
                {weather.temp_min != null && `${Math.round(weather.temp_min)}° `}
                {weather.temp_max != null && `${Math.round(weather.temp_max)}° `}
                {weather.wind_speed != null && `${Math.round(weather.wind_speed)} km/h`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Data rows */}
      <div className="px-3.5 py-3 space-y-3" style={{ borderBottom: '1px solid #201E1B' }}>
        <DataRow
          label={t('hud.airQuality')}
          value={aqiLabel}
          sub={aqi ? `${aqi} AQI` : null}
          pct={aqiPct}
          color={aqiColor}
        />
        <DataRow
          label={t('hud.traffic')}
          value={congLabel}
          sub={`${congestionPct}%`}
          pct={congestionPct}
          color={congColor}
        />
        <DataRow
          label={t('hud.bicing')}
          value={totalBikes > 0 ? totalBikes.toLocaleString('ca') : '—'}
          sub={totalBikes > 0 ? `${t('hud.bikes')} · ${bicingPct}%` : null}
          pct={bicingPct}
          color={C.orange}
        />
      </div>

      {/* AQI pollutant detail */}
      {airQuality && (airQuality.pm25 != null || airQuality.pm10 != null || airQuality.no2 != null || airQuality.o3 != null) && (
        <div className="px-3.5 py-3" style={{ borderBottom: '1px solid #201E1B' }}>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] mb-2.5" style={{ color: '#8C8884' }}>
            {t('hud.pollutants')}
          </p>
          <div className="space-y-2">
            {[
              { label: 'PM2.5', value: airQuality.pm25,  max: 35  },
              { label: 'PM10',  value: airQuality.pm10,  max: 50  },
              { label: 'NO₂',   value: airQuality.no2,   max: 100 },
              { label: 'O₃',    value: airQuality.o3,    max: 120 },
            ].filter(r => r.value != null).map(row => {
              const pct   = Math.min(100, (row.value / row.max) * 100)
              const color = pct < 50 ? C.green : pct < 80 ? C.amber : C.red
              return (
                <div key={row.label}>
                  <div className="flex justify-between mb-0.5">
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: '#8C8884' }}>{row.label}</span>
                    <span className="font-mono text-[10px] tabular-nums" style={{ color }}>{row.value.toFixed(1)}</span>
                  </div>
                  <div className="h-[2px] w-full rounded-full" style={{ background: '#2C2926' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Forecast */}
      <ForecastStrip forecast={forecast} />
    </div>
  )
}

export default function CityHud() {
  const { t } = useTranslation()
  const weather     = useDataStore(s => s.weather)
  const airQuality  = useDataStore(s => s.airQuality)
  const traffic     = useDataStore(s => s.traffic)
  const bicing      = useDataStore(s => s.bicing)
  const forecast    = useDataStore(s => s.forecast)
  const lastUpdated = useDataStore(s => s.lastUpdated)
  const isHistorical = useTimeStore(s => s.isHistorical)

  const [open, setOpen] = useState(false)
  const timerRef = useRef(null)

  const show = () => { clearTimeout(timerRef.current); setOpen(true) }
  const hide = () => { timerRef.current = setTimeout(() => setOpen(false), 180) }

  const congested     = traffic.filter(tr => ['congestionado', 'cortado'].includes(tr.estado)).length
  const congestionPct = traffic.length ? Math.round((congested / traffic.length) * 100) : 0
  const statusColor   = congestionPct < 15 ? C.green : congestionPct < 40 ? C.amber : C.red

  const iconPrefix  = weather?.icon?.slice(0, 2) ?? '01'
  const shortLabel  = t(`weather.icon.${iconPrefix}`, { defaultValue: weather?.description ?? '' })

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      {/* Compact pill */}
      <div
        className="flex items-center gap-2 h-9 px-2.5 rounded-lg cursor-default select-none transition-colors"
        style={{ background: open ? '#201E1B' : 'transparent' }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{
            background: isHistorical ? C.amber : statusColor,
            boxShadow: `0 0 5px ${isHistorical ? C.amber : statusColor}`,
          }}
        />
        <span className="font-syne text-[13px] font-medium" style={{ color: '#F7F6F4' }}>
          {weather?.temp != null ? `${Math.round(weather.temp)}°` : '—'}
        </span>
        {shortLabel && (
          <span className="font-syne text-[11px]" style={{ color: '#666' }}>
            {shortLabel}
          </span>
        )}
      </div>

      {/* Hover dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute top-full left-0 mt-2 z-[60]"
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            <HudExpanded
              weather={weather}
              airQuality={airQuality}
              traffic={traffic}
              bicing={bicing}
              forecast={forecast}
              now={lastUpdated ?? new Date()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
