import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useRouteStore } from '../../store/routeStore'
import { useMapStore } from '../../store/mapStore'
import { useDataStore } from '../../store/dataStore'
import { useRoute } from '../../hooks/useRoute'
import { fetchRoute, fetchMetroArrivals, fetchBusArrivals, addSavedRoute } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { geocodeSearch } from '../../utils/geocode'

/* ─────────────────────────────────────────────────────────────────────
 * Constantes
 * ───────────────────────────────────────────────────────────────────── */


const MODES = [
  { id: 'foot',   color: '#ffffff' },
  { id: 'bicing', color: '#00ff88' },
  { id: 'metro',  color: '#ff6b35' },
  { id: 'bus',    color: '#00b4ff' },
  { id: 'car',    color: '#ffaa00' },
]

const MODE_BY_ID = Object.fromEntries(MODES.map(m => [m.id, m]))

const CATEGORY_LABELS = {
  restaurant: 'Rest.', shop: 'Tienda', tourism: 'Turismo',
  park: 'Parque', transit: 'Tránsito', place: 'Lugar',
  building: 'Edif.', health: 'Salud', education: 'Edu.',
  street: 'Calle', amenity: 'Serv.',
}

/* ─────────────────────────────────────────────────────────────────────
 * Iconos SVG inline
 * ───────────────────────────────────────────────────────────────────── */

const Icon = {
  search: (p) => (
    <svg width={p.size ?? 13} height={p.size ?? 13} viewBox="0 0 16 16" fill="none" style={p.style}>
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
      <line x1="10.7" y1="10.7" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  myLocation: (p) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 16 16" fill="none" style={p.style}>
      <circle cx="8" cy="8" r="2.3" fill="currentColor" />
      <circle cx="8" cy="8" r="5.3" stroke="currentColor" strokeWidth="1.2" />
      <line x1="8" y1="0" x2="8" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="8" y1="14" x2="8" y2="16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="0" y1="8" x2="2" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="14" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  swap: (p) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 16 16" fill="none" style={p.style}>
      <path d="M4 3 L4 12 M2 10 L4 12 L6 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M12 13 L12 4 M10 6 L12 4 L14 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),
  close: (p) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 16 16" fill="none" style={p.style}>
      <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  back: (p) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 16 16" fill="none" style={p.style}>
      <path d="M10 3 L4 8 L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),
  pin: (p) => (
    <svg width={p.size ?? 12} height={p.size ?? 12} viewBox="0 0 12 12" fill="none" style={p.style}>
      <path d="M6 1 C3.5 1 1.8 2.7 1.8 5 C1.8 8 6 11 6 11 C6 11 10.2 8 10.2 5 C10.2 2.7 8.5 1 6 1 Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx="6" cy="5" r="1.4" fill="currentColor" />
    </svg>
  ),
  // Modo: persona caminando
  foot: (p) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" style={p.style}>
      <circle cx="13" cy="4" r="1.8" fill="currentColor" />
      <path d="M13 7 L10 12 L8 18 M13 7 L15 11 L17 14 M10 12 L13 14 L13 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M8 18 L7 22 M13 18 L13 22 M17 14 L19 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  ),
  // Modo: bicicleta
  bicing: (p) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" style={p.style}>
      <circle cx="5.5" cy="17" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="18.5" cy="17" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M5.5 17 L10 8 L15 8 L18.5 17 M10 8 L13 17 M13 6 L16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),
  // Modo: coche
  car: (p) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" style={p.style}>
      <path d="M3 14 L4.5 9 C4.7 8.3 5.3 8 6 8 L18 8 C18.7 8 19.3 8.3 19.5 9 L21 14 L21 18 C21 18.5 20.5 19 20 19 L19 19 C18.5 19 18 18.5 18 18 L18 17 L6 17 L6 18 C6 18.5 5.5 19 5 19 L4 19 C3.5 19 3 18.5 3 18 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <circle cx="7" cy="14" r="1.2" fill="currentColor" />
      <circle cx="17" cy="14" r="1.2" fill="currentColor" />
    </svg>
  ),
  // Modo: metro
  metro: (p) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" style={p.style}>
      <rect x="5" y="3" width="14" height="15" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="5" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8.5" cy="14.5" r="1.1" fill="currentColor" />
      <circle cx="15.5" cy="14.5" r="1.1" fill="currentColor" />
      <path d="M7 18 L5 21 M17 18 L19 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  // Modo: bus urbano
  bus: (p) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" style={p.style}>
      <rect x="3" y="5" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="7.5" cy="14.5" r="1.1" fill="currentColor" />
      <circle cx="16.5" cy="14.5" r="1.1" fill="currentColor" />
      <line x1="12" y1="5" x2="12" y2="17" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
      <path d="M3 7 L1 7 M21 7 L23 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  // Segmento: paso a pie (huella)
  segWalk: (p) => (
    <svg width={p.size ?? 11} height={p.size ?? 11} viewBox="0 0 12 12" fill="none" style={p.style}>
      <path d="M6 1 L6 8 M3 5 L6 1 L9 5 M4 11 L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),
  // Segmento: bici (hexágono)
  segBike: (p) => (
    <svg width={p.size ?? 11} height={p.size ?? 11} viewBox="0 0 12 12" fill="none" style={p.style}>
      <path d="M6 1 L10.2 3.5 L10.2 8.5 L6 11 L1.8 8.5 L1.8 3.5 Z" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </svg>
  ),
}

const SEG_ICONS = {
  walk:  Icon.segWalk,
  bike:  Icon.segBike,
  drive: null,
  metro: null,
  bus:   null,
}

const MODE_ICONS = {
  foot:   Icon.foot,
  bicing: Icon.bicing,
  metro:  Icon.metro,
  bus:    Icon.bus,
  car:    Icon.car,
}

/* ─────────────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────────────── */

function fmtDist(m) {
  if (m == null) return ''
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function fmtTime(s) {
  if (s == null) return ''
  const min = Math.max(1, Math.round(s / 60))
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}min` : `${min} min`
}

async function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('no-geo')); return }
    navigator.geolocation.getCurrentPosition(
      p  => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'Mi ubicación' }),
      () => reject(new Error('denied')),
      { timeout: 8000 }
    )
  })
}

function useDebouncedSuggestions(query, delay = 300) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    let active = true
    const t = setTimeout(async () => {
      const r = await geocodeSearch(query)
      if (active) {
        setResults(r)
        setLoading(false)
      }
    }, delay)
    return () => { active = false; clearTimeout(t) }
  }, [query, delay])
  return { results, loading }
}

/* ─────────────────────────────────────────────────────────────────────
 * Sub-componente: lista de sugerencias
 * ───────────────────────────────────────────────────────────────────── */

function SuggestionList({ items, loading, query, onPick }) {
  if (!query || query.length < 2) return null
  return (
    <AnimatePresence>
      <motion.div
        key="suggestions"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        className="mt-2 rounded-xl overflow-hidden bg-black/70 border border-white/[0.06]"
      >
        {loading && items.length === 0 && (
          <div className="px-3 py-3 flex items-center gap-2">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
            <span className="text-[10px] text-white/30 font-mono ml-1">Buscando...</span>
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="px-3 py-2.5 text-[11px] text-white/30 font-mono">Sin resultados en Barcelona</div>
        )}
        {items.map((s, i) => (
          <motion.button
            key={`${s.lat}-${s.lng}-${i}`}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03, duration: 0.18 }}
            onMouseDown={(e) => { e.preventDefault(); onPick(s) }}
            className="w-full text-left px-3 py-2 flex items-start gap-2.5
              hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-0"
          >
            <span className="text-white/40 flex-shrink-0 mt-0.5"><Icon.pin /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-white/85 text-xs font-mono leading-snug">{s.main ?? s.label}</span>
              {s.sub && <span className="block text-white/35 text-[10px] font-mono leading-snug truncate">{s.sub}</span>}
            </span>
            {s.category && s.category !== 'address' && (
              <span className="text-[9px] font-mono text-white/30 bg-white/[0.05] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                {CATEGORY_LABELS[s.category] ?? s.category}
              </span>
            )}
          </motion.button>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * Sub-componente: badge de línea de metro (color real)
 * ───────────────────────────────────────────────────────────────────── */

function MetroLineBadge({ name, color }) {
  const bg = color ? (color.startsWith('#') ? color : '#' + color) : '#A855F7'
  return (
    <span
      className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-white"
      style={{ background: bg, boxShadow: `0 0 6px ${bg}55` }}
    >
      {name}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * Sub-componente: secuencia de pasos de una ruta calculada
 *   Bicing: ↑3min · ⬡12min · ↑2min
 *   Metro:  ↑5min · [L3] 11min · ↑2min
 * ───────────────────────────────────────────────────────────────────── */

function SegmentSequence({ segments, metroLines }) {
  if (!segments?.length) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {segments.map((seg, i) => {
        const SegIcon = SEG_ICONS[seg.type]
        const isTransit = seg.type === 'metro' || seg.type === 'bus'
        const lineNames = seg.meta?.lines ?? []
        const lineLookup = (name) => metroLines.find(l => l.name === name)

        return (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-white/15 text-[10px]">·</span>}
            <span className="inline-flex items-center gap-1 text-[10px] font-mono" style={{ color: seg.color }}>
              {SegIcon && <SegIcon />}
              {isTransit && lineNames.length > 0 && lineNames.slice(0, 2).map((ln, k) => {
                const isBus = seg.type === 'bus'
                const lineRec = !isBus ? lineLookup(ln) : null
                const color = isBus ? (seg.meta?.line_colors?.[ln] ?? '#00b4ff') : lineRec?.color
                return <MetroLineBadge key={k} name={ln} color={color} />
              })}
              <span>{fmtTime(seg.duration)}</span>
            </span>
          </React.Fragment>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * Sub-componente: tarjeta de modo (Fase opciones)
 * ───────────────────────────────────────────────────────────────────── */

function ModeCard({ mode, state, isActive, onClick, onPickAlternative, metroLines }) {
  const { t }    = useTranslation()
  const ModeIcon = MODE_ICONS[mode.id]
  const { color } = mode
  const data    = state?.data
  const loading = state?.loading
  const failed  = state?.error
  const warming = state?.warming

  const alternatives = data?.alternatives ?? []
  const [selectedAlt, setSelectedAlt] = React.useState(0)

  // Reset selected alt when data changes (new route calculated)
  React.useEffect(() => { setSelectedAlt(0) }, [data])

  const activeAlt  = alternatives.length > 0 ? (alternatives[selectedAlt] ?? alternatives[0]) : null
  const segs       = activeAlt?.segments ?? data?.segments ?? []
  const altDuration = activeAlt?.duration ?? data?.duration
  const altDistance = activeAlt?.distance ?? data?.distance
  const altInefficient = activeAlt?.inefficient ?? data?.inefficient

  // Resumen de meta de info contextual (estaciones, líneas)
  let metaLine = null
  if (mode.id === 'bicing' && segs.length) {
    const bikeSeg = segs.find(s => s.type === 'bike')
    if (bikeSeg?.meta?.from_station) {
      metaLine = (
        <span>
          {bikeSeg.meta.from_station}
          {bikeSeg.meta.bikes_available != null && ` · ${bikeSeg.meta.bikes_available} bicis`}
        </span>
      )
    }
  } else if (mode.id === 'metro' && segs.length) {
    const metroSegs = segs.filter(s => s.type === 'metro')
    if (metroSegs.length > 1) {
      const lines = metroSegs.map(s => s.meta?.lines?.[0]).filter(Boolean)
      metaLine = <span>{lines.join(' → ')}</span>
    } else if (metroSegs[0]?.meta?.from_station) {
      const m = metroSegs[0].meta
      metaLine = <span>{m.from_station} → {m.to_station}</span>
    }
  } else if (mode.id === 'bus' && segs.length) {
    const busSegs = segs.filter(s => s.type === 'bus')
    if (busSegs.length > 1) {
      const lines = busSegs.map(s => s.meta?.lines?.[0]).filter(Boolean)
      metaLine = <span>{[...new Set(lines)].join(' → ')}</span>
    } else if (busSegs[0]?.meta?.from_station) {
      const m = busSegs[0].meta
      metaLine = <span>{m.from_station} → {m.to_station}</span>
    }
  }

  const trafficNote  = mode.id === 'car' ? (data?.traffic?.note ?? data?.segments?.[0]?.meta?.traffic_note) : null
  const congestion   = mode.id === 'car' ? (data?.traffic?.congestion ?? data?.segments?.[0]?.meta?.congestion) : null
  const trafficColor = congestion >= 80 ? '#ff3333' : congestion >= 60 ? '#ffcc00' : '#00ff88'
  const inefficient  = (altInefficient ?? data?.inefficient) === true
  const inefficientReason = data?.inefficient_reason

  const accentColor = isActive && !inefficient ? color : inefficient ? '#6B6865' : '#2C2926'

  const handleAltClick = (e, idx) => {
    e.stopPropagation()
    setSelectedAlt(idx)
    if (onPickAlternative && alternatives[idx]) onPickAlternative(alternatives[idx])
  }

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.99 }}
      className="w-full text-left overflow-hidden flex transition-all"
      style={{
        borderRadius: 6,
        border: `1px solid ${isActive && !inefficient ? color + '55' : '#2C2926'}`,
        background: isActive && !inefficient ? '#211F1B' : inefficient ? '#111' : '#201E1B',
        opacity: inefficient ? 0.55 : 1,
      }}
    >
      {/* 3px accent bar */}
      <div className="w-[3px] flex-shrink-0 self-stretch transition-colors" style={{ background: accentColor, borderRadius: '2px 0 0 2px' }} />

      <div className="flex items-center gap-3 px-3 py-2.5 flex-1 min-w-0">
        <span
          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
          style={{
            color:      inefficient ? '#7D7975' : color,
            background: '#2C2926',
          }}
        >
          <ModeIcon size={18} />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em]"
                  style={{ color: inefficient ? '#7D7975' : isActive ? color : '#B0ACA7' }}>
              {t(`modes.${mode.id}`)}
            </span>

            <div className="flex items-center gap-2">
              {mode.isRecommended && (
                <span className="font-mono text-[8px] uppercase tracking-[0.08em] px-1.5 py-0.5"
                  style={{ background: '#B8885A', color: '#fff', borderRadius: 3 }}>
                  IA
                </span>
              )}
              {data && !inefficient && (
                <span className="font-syne text-[13px] font-semibold" style={{ color: isActive ? color : '#F7F6F4' }}>
                  {fmtTime(altDuration ?? data.duration)}
                </span>
              )}
              {data && inefficient && (
                <span className="font-mono text-[9px] uppercase tracking-[0.08em] flex items-center gap-1" style={{ color: '#C98E2E' }}>
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M5 1L9.3 8.5H0.7L5 1Z" stroke="currentColor" strokeWidth="1" fill="none"/><line x1="5" y1="4" x2="5" y2="6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/><circle cx="5" cy="7.5" r="0.5" fill="currentColor"/></svg>
                  No eficient
                </span>
              )}
              {loading && (
                <span className="w-3 h-3 rounded-full border border-t-transparent animate-spin flex-shrink-0" style={{ borderColor: color + '44', borderTopColor: 'transparent' }} />
              )}
              {failed && !warming && <span className="font-mono text-[9px]" style={{ color: '#8C8884' }}>No disponible</span>}
              {failed && warming && <span className="font-mono text-[9px]" style={{ color: '#B8885A' }}>Carregant xarxa...</span>}
            </div>
          </div>

          {/* Loading skeleton — same height as loaded card to prevent reflow */}
          {loading && (
            <div className="mt-1.5 flex flex-col gap-1.5">
              <div className="h-3 rounded animate-pulse" style={{ background: color + '18', width: '55%' }} />
              <div className="h-2.5 rounded animate-pulse" style={{ background: '#2C2926', width: '35%' }} />
            </div>
          )}

          {data && segs.length > 0 && !inefficient && (
            <div className="mt-1.5">
              <SegmentSequence segments={segs} metroLines={metroLines} />
            </div>
          )}
          {data && inefficient && inefficientReason && (
            <p className="mt-0.5 font-mono text-[10px]" style={{ color: '#8C8884' }}>{inefficientReason}</p>
          )}
          {data && !inefficient && (
            <div className="mt-1 flex items-center gap-2 font-mono text-[10px]" style={{ color: '#8C8884' }}>
              {altDistance != null && <span>{fmtDist(altDistance)}</span>}
              {trafficNote && (
                <span className="font-mono text-[9px] px-1.5 py-0.5" style={{ color: trafficColor, background: trafficColor + '18', borderRadius: 3 }}>
                  {trafficNote}
                </span>
              )}
              {!trafficNote && metaLine && <span className="truncate">· {metaLine}</span>}
            </div>
          )}

          {/* Alternatives selector — bus/metro only, when >1 option returned */}
          {data && alternatives.length > 1 && (
            <div className="mt-1.5 flex gap-1" onClick={e => e.stopPropagation()}>
              {alternatives.map((alt, idx) => (
                <button
                  key={idx}
                  onClick={(e) => handleAltClick(e, idx)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[9px] transition-colors"
                  style={{
                    background: selectedAlt === idx ? color + '22' : '#1C1A17',
                    border: `1px solid ${selectedAlt === idx ? color + '55' : '#2C2926'}`,
                    color: selectedAlt === idx ? color : '#8C8884',
                  }}
                >
                  <span>{alt.lines_label}</span>
                  <span style={{ color: selectedAlt === idx ? color + 'aa' : '#5C5A56' }}>
                    {fmtTime(alt.duration)}
                  </span>
                  {alt.transfers > 0 && (
                    <span style={{ color: '#6B6865' }}>{alt.transfers}t</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * Sub-componente: hook de llegadas de metro con refetch cada 60s
 * ───────────────────────────────────────────────────────────────────── */

function useMetroArrivals(stationId) {
  const [data, setData] = useState({ loading: false, trains: null })
  const renderCount = useRef(0)

  useEffect(() => {
    renderCount.current += 1
    if (!stationId) { setData({ loading: false, trains: null, mounts: renderCount.current }); return }
    let cancelled = false

    const load = async () => {
      setData(prev => ({ loading: prev.trains == null, trains: prev.trains, mounts: renderCount.current }))
      try {
        const r = await fetchMetroArrivals(stationId)
        if (cancelled) return
        const trains = Array.isArray(r?.trains) ? r.trains : null
        setData({ loading: false, trains, mounts: renderCount.current })
      } catch {
        if (cancelled) return
        setData({ loading: false, trains: null, mounts: renderCount.current })
      }
    }

    load()
    const t = setInterval(load, 60000)
    return () => { cancelled = true; clearInterval(t) }
  }, [stationId])

  return data
}

function useBusArrivals(stopId) {
  const [data, setData] = useState({ loading: false, buses: null })
  const ref = useRef(0)
  useEffect(() => {
    ref.current++
    if (!stopId) { setData({ loading: false, buses: null }); return }
    let cancelled = false
    const load = async () => {
      setData(prev => ({ loading: prev.buses == null, buses: prev.buses }))
      try {
        const r = await fetchBusArrivals(stopId)
        if (cancelled) return
        setData({ loading: false, buses: Array.isArray(r?.buses) ? r.buses : null })
      } catch {
        if (cancelled) return
        setData({ loading: false, buses: null })
      }
    }
    load()
    const id = setInterval(load, 45000)
    return () => { cancelled = true; clearInterval(id) }
  }, [stopId])
  return data
}

/* ─────────────────────────────────────────────────────────────────────
 * Sub-componente: nodo de estación dentro del timeline de RouteStepPanel
 * ───────────────────────────────────────────────────────────────────── */

function MetroArrivalsLine({ stationId, lines }) {
  const { t } = useTranslation()
  const { loading, trains } = useMetroArrivals(stationId)

  if (loading && !trains) {
    return (
      <span className="inline-flex items-center gap-1">
        {[0, 150, 300].map(d => (
          <span
            key={d}
            className="w-1 h-1 rounded-full bg-cyan-400/60 animate-bounce"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </span>
    )
  }

  if (!trains || trains.length === 0) return null

  // Flatten all individual train minutes, filtered by relevant lines
  const relevant = lines?.length ? trains.filter(t => lines.includes(t.line)) : trains
  const pool = relevant.length ? relevant : trains

  const allMinutes = pool
    .flatMap(t => (t.arrivals ?? []).map(m => m))
    .filter(m => m !== undefined && m !== null)
    .sort((a, b) => a - b)
    .slice(0, 3)

  if (!allMinutes.length) return null

  const label = allMinutes
    .map(m => (m === 0 ? t('metro.now') : t('metro.min', { n: m })))
    .join(' · ')

  return (
    <span className="text-cyan-400/70 text-[10px] font-mono">
      {label}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * Sub-componente: panel detallado de pasos de la ruta activa (timeline)
 * ───────────────────────────────────────────────────────────────────── */

// Arrivals for bus: "Próx. 3 min · 9 min" — line removed from chip, it's already in the badge
function BusArrivalsChips({ stopId, lineFilter }) {
  const { t } = useTranslation()
  const { loading, buses } = useBusArrivals(stopId)

  if (loading && !buses) return (
    <span className="inline-flex items-center gap-1 h-4">
      {[0,120,240].map(d => (
        <span key={d} className="w-1 h-1 rounded-full animate-bounce"
          style={{ background: '#00b4ff66', animationDelay: `${d}ms` }} />
      ))}
    </span>
  )
  if (!buses?.length) return null

  const relevant = lineFilter ? buses.filter(b => b.line === lineFilter) : buses
  const pool = relevant.length ? relevant : buses.slice(0, 2)
  const allTimes = pool
    .flatMap(b => (b.arrivals ?? []).slice(0, 2))
    .filter(m => m != null)
    .sort((a, b) => a - b)
    .slice(0, 3)

  if (!allTimes.length) return null

  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px]">
      <span style={{ color: '#ffffff35' }}>Próx.</span>
      {allTimes.map((m, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ color: '#ffffff20' }}>·</span>}
          <span className="font-bold tabular-nums" style={{ color: '#00b4ff' }}>
            {m === 0 ? t('metro.now') : t('metro.min', { n: m })}
          </span>
        </React.Fragment>
      ))}
    </span>
  )
}

// Metro arrivals: same clean format
function MetroArrivalsChips({ stationId, lines }) {
  const { t } = useTranslation()
  const { loading, trains } = useMetroArrivals(stationId)

  if (loading && !trains) return (
    <span className="inline-flex items-center gap-1 h-4">
      {[0,120,240].map(d => (
        <span key={d} className="w-1 h-1 rounded-full animate-bounce"
          style={{ background: '#ffffff44', animationDelay: `${d}ms` }} />
      ))}
    </span>
  )
  if (!trains?.length) return null

  const relevant = lines?.length ? trains.filter(tr => lines.includes(tr.line)) : trains
  const pool = relevant.length ? relevant : trains
  const allTimes = pool
    .flatMap(tr => (tr.arrivals ?? []).slice(0, 2))
    .filter(m => m != null)
    .sort((a, b) => a - b)
    .slice(0, 3)

  if (!allTimes.length) return null

  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px]">
      <span style={{ color: '#ffffff35' }}>Próx.</span>
      {allTimes.map((m, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ color: '#ffffff20' }}>·</span>}
          <span className="font-bold tabular-nums" style={{ color: '#a8ffde' }}>
            {m === 0 ? t('metro.now') : t('metro.min', { n: m })}
          </span>
        </React.Fragment>
      ))}
    </span>
  )
}

// ── Timeline layout: LEFT = 32px col (badge/line), RIGHT = content ────────

function StepNodeOrigin({ label }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 flex justify-center flex-shrink-0">
        <span className="w-2 h-2 rounded-full" style={{ background: '#ffffff', boxShadow: '0 0 4px #ffffff88' }} />
      </span>
      <span className="font-syne text-[11px] font-medium text-white/55 truncate">
        {label ?? 'Mi ubicación'}
      </span>
    </div>
  )
}

function StepNodeDest({ label }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 flex justify-center flex-shrink-0">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff6b35', boxShadow: '0 0 7px #ff6b3599' }} />
      </span>
      <span className="font-syne text-[13px] font-semibold text-white/90 truncate">
        {label ?? 'Destino'}
      </span>
    </div>
  )
}

function StepNodeBicing({ name, bikes, ebikes, docks }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-8 flex justify-center flex-shrink-0 pt-0.5">
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-[#00ff88] flex-shrink-0"
          style={{ background: 'rgba(0,255,136,0.10)', boxShadow: '0 0 6px rgba(0,255,136,0.4), inset 0 0 0 1px rgba(0,255,136,0.5)' }}
        >
          <Icon.segBike size={11} />
        </span>
      </span>
      <div className="flex-1 min-w-0 py-0.5">
        <p className="font-syne text-[12px] font-semibold text-white/85 truncate">{name}</p>
        <p className="font-mono text-[10px] text-white/40 mt-0.5">
          {bikes != null && `${bikes} ${bikes === 1 ? 'bici' : 'bicis'}`}
          {ebikes != null && bikes != null && ' · '}
          {ebikes != null && `${ebikes} e-bicis`}
          {docks != null && (bikes != null || ebikes != null) && ' · '}
          {docks != null && `${docks} muelles`}
        </p>
      </div>
    </div>
  )
}

// Transit stop node — shared layout for metro and bus
function TransitStopNode({ badge, badgeColor, badgeGlow, name, direction, dirColor, arrivals, t }) {
  return (
    <div className="flex items-start gap-3">
      {/* Left: line badge */}
      <span className="w-8 flex justify-center flex-shrink-0 pt-0.5">
        <span
          className="inline-flex items-center justify-center h-6 px-1.5 rounded-[5px] font-mono font-bold text-white text-[10px] min-w-[24px]"
          style={{ background: badgeColor, boxShadow: `0 0 10px ${badgeGlow}` }}
        >
          {badge}
        </span>
      </span>
      {/* Right: name + direction + arrivals */}
      <div className="flex-1 min-w-0 py-0.5">
        <p className="font-syne text-[13px] font-semibold text-white/90 truncate leading-tight">{name}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {direction && (
            <span className="font-mono text-[9px] truncate" style={{ color: dirColor }}>
              dir. {direction}
            </span>
          )}
          {arrivals}
        </div>
      </div>
    </div>
  )
}

function StepNodeMetro({ name, lineNames, lineColors, stationId, direction }) {
  const { t } = useTranslation()
  const primary = lineNames?.[0]
  const rawColor = primary && lineColors?.[primary] ? lineColors[primary] : 'A855F7'
  const bg = rawColor.startsWith('#') ? rawColor : '#' + rawColor

  return (
    <TransitStopNode
      badge={primary ?? 'M'}
      badgeColor={bg}
      badgeGlow={bg + '66'}
      name={name}
      direction={direction}
      dirColor={bg + 'bb'}
      arrivals={stationId ? <MetroArrivalsChips stationId={stationId} lines={lineNames} /> : null}
      t={t}
    />
  )
}

function StepNodeBus({ name, lineNames, stopId, direction }) {
  const { t } = useTranslation()
  const primary = lineNames?.[0]

  return (
    <TransitStopNode
      badge={primary ?? 'B'}
      badgeColor="#00b4ff"
      badgeGlow="#00b4ff55"
      name={name}
      direction={direction}
      dirColor="#00b4ffaa"
      arrivals={stopId ? <BusArrivalsChips stopId={stopId} lineFilter={primary} /> : null}
      t={t}
    />
  )
}

function StepNodeTransfer({ name, fromLine, fromColor, toLine, toColor, toDirection, stationId }) {
  const { t } = useTranslation()
  const fromClr = fromColor ?? '#8C8884'
  const toClr   = toColor   ?? '#8C8884'

  return (
    <div className="flex items-start gap-3">
      {/* Left: paired badges */}
      <span className="w-8 flex justify-center flex-shrink-0 pt-0.5">
        <span className="flex items-center gap-0.5">
          <span
            className="inline-flex items-center justify-center h-5 px-1 rounded-[4px] font-mono font-bold text-white text-[9px] min-w-[18px]"
            style={{ background: fromClr, boxShadow: `0 0 6px ${fromClr}55` }}
          >
            {fromLine ?? '?'}
          </span>
          <svg width="8" height="8" viewBox="0 0 8 8" style={{ color: '#ffffff30' }}>
            <path d="M1 4h6M4 1l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
          <span
            className="inline-flex items-center justify-center h-5 px-1 rounded-[4px] font-mono font-bold text-white text-[9px] min-w-[18px]"
            style={{ background: toClr, boxShadow: `0 0 6px ${toClr}55` }}
          >
            {toLine ?? '?'}
          </span>
        </span>
      </span>
      {/* Right */}
      <div className="flex-1 min-w-0 py-0.5">
        <p className="font-syne text-[12px] font-semibold text-white/80 truncate leading-tight">{name}</p>
        <span className="font-mono text-[9px] uppercase tracking-wide" style={{ color: '#ffffff30' }}>
          {t('search.transfer')}
          {toDirection && <span style={{ color: toClr + 'bb' }}> · dir. {toDirection}</span>}
        </span>
        {stationId && (
          <div className="mt-1">
            <MetroArrivalsChips stationId={stationId} lines={[toLine].filter(Boolean)} />
          </div>
        )}
      </div>
    </div>
  )
}

// Segment row: continuous colored line left, compact pill right
function StepSegment({ seg }) {
  const SegIcon = SEG_ICONS[seg.type]
  const isMetro = seg.type === 'metro'
  const isBus   = seg.type === 'bus'

  let label = 'Tramo'
  if (seg.type === 'walk')  label = 'A pie'
  else if (seg.type === 'bike')  label = 'Bicing'
  else if (seg.type === 'drive') label = 'Coche'
  else if (isMetro) { const ln = seg.meta?.lines?.[0]; label = ln ? `Metro ${ln}` : 'Metro' }
  else if (isBus)   { const ln = seg.meta?.lines?.[0] ?? seg.meta?.line; label = ln ? `Bus ${ln}` : 'Bus' }

  const color = seg.color ?? '#ffffff55'

  return (
    <div className="flex items-center gap-3 py-0.5">
      {/* Continuous spine line */}
      <span className="w-8 flex justify-center flex-shrink-0">
        <span className="w-[2px] rounded-full" style={{ height: 28, background: `linear-gradient(to bottom, ${color}66, ${color}33)` }} />
      </span>
      {/* Info pill */}
      <span
        className="inline-flex items-center gap-1.5 font-mono text-[10px] px-2 py-[3px] rounded-full"
        style={{ color, background: color + '12', border: `1px solid ${color}25` }}
      >
        {SegIcon && <SegIcon size={9} />}
        <span>{label}</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span className="font-bold tabular-nums">{fmtTime(seg.duration)}</span>
        {seg.distance != null && (
          <><span style={{ opacity: 0.3 }}>·</span><span style={{ opacity: 0.5 }}>{fmtDist(seg.distance)}</span></>
        )}
      </span>
    </div>
  )
}

/* ── Numbered turn-by-turn steps (foot / bike) ──────────────────────── */

function NumberedSteps({ steps, currentStep }) {
  if (!steps?.length) return null
  return (
    <div className="flex flex-col">
      {steps.map((step, i) => {
        const isCurrent = i === currentStep
        return (
          <div key={i} className="flex items-start gap-2.5 py-1.5"
            style={{ borderBottom: i < steps.length - 1 ? '1px solid #201E1B' : 'none' }}>
            {/* Step number badge */}
            <span
              className="w-5 h-5 rounded flex items-center justify-center font-mono text-[9px] font-semibold flex-shrink-0 mt-0.5"
              style={{
                background: isCurrent ? '#B8885A' : '#211F1B',
                border: `1px solid ${isCurrent ? '#B8885A' : '#2C2926'}`,
                color: isCurrent ? '#fff' : '#8C8884',
              }}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[11px] leading-snug"
                style={{ color: isCurrent ? '#F7F6F4' : '#B0ACA7' }}>
                {step.instruction}
              </p>
              {step.distance > 0 && (
                <p className="font-mono text-[9px] mt-0.5" style={{ color: '#8C8884' }}>
                  {fmtDist(step.distance)}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RouteStepPanel({ segments, origin, destination, mode }) {
  const { t } = useTranslation()
  const { isNavigating, startNavigation, stopNavigation, currentStepIndex } = useRouteStore()
  const preferences   = useAuthStore(s => s.preferences)
  const canNavigate   = (mode === 'foot' || mode === 'bicing') && segments?.[0]?.steps?.length > 0
  const isSimpleRoute = segments?.length <= 2 && (mode === 'foot' || mode === 'bicing')

  const firstSeg       = segments?.[0]
  const hasLongWalk    = firstSeg?.type === 'walk' && firstSeg?.duration > (preferences?.max_walk_minutes ?? 15) * 60
  const showBicingHint = hasLongWalk && preferences?.has_bicing === true && (mode === 'metro' || mode === 'bus')

  if (!segments?.length) return null

  // For foot/bike routes with actual steps → show numbered steps
  const allSteps = isSimpleRoute
    ? segments.flatMap(seg => seg.steps ?? []).filter(s => s.instruction)
    : []

  /* For multimodal / transit → show transit node timeline */
  const nodes = []
  nodes.push({ kind: 'origin', label: origin?.label })

  for (let i = 0; i < segments.length; i++) {
    const seg  = segments[i]
    const next = segments[i + 1]
    nodes.push({ kind: 'segment', seg })

    if (next) {
      if (seg.type === 'walk' && next.type === 'bike') {
        const m = next.meta ?? {}
        nodes.push({ kind: 'bicing', name: m.from_station ?? 'Estació Bicing',
          bikes: m.bikes_available, ebikes: m.ebikes_available, docks: null })
      } else if (seg.type === 'bike' && next.type === 'walk') {
        const m = seg.meta ?? {}
        nodes.push({ kind: 'bicing', name: m.to_station ?? 'Estació Bicing',
          bikes: null, ebikes: null, docks: m.docks_available })
      } else if (seg.type === 'walk' && (next.type === 'metro' || next.type === 'bus')) {
        const m = next.meta ?? {}
        const isBus = next.type === 'bus'
        nodes.push({
          kind: isBus ? 'bus_stop' : 'metro',
          name: m.from_station ?? (isBus ? 'Parada' : 'Estació'),
          lineNames: m.lines ?? [], lineColors: m.line_colors ?? {},
          stationId: m.from_station_id ?? null,
          stopId: isBus ? (m.from_station_id ?? null) : null,
          direction: m.direction ?? null,
        })
      } else if ((seg.type === 'metro' || seg.type === 'bus') && (next.type === 'metro' || next.type === 'bus')) {
        const m = seg.meta ?? {}
        const nextIsBus = next.type === 'bus'
        nodes.push({
          kind: 'transfer', name: m.to_station ?? 'Transbord',
          fromLine: seg.meta?.lines?.[0], fromColor: seg.color,
          toLine: next.meta?.lines?.[0], toColor: next.color,
          toDirection: next.meta?.direction ?? null,
          stationId: nextIsBus ? null : (m.to_station_id ?? null),
          toStopId: nextIsBus ? (next.meta?.from_station_id ?? null) : null,
        })
      } else if ((seg.type === 'metro' || seg.type === 'bus') && next.type === 'walk') {
        const m = seg.meta ?? {}
        const isBus = seg.type === 'bus'
        nodes.push({
          kind: isBus ? 'bus_stop' : 'metro',
          name: m.to_station ?? (isBus ? 'Parada' : 'Estació'),
          lineNames: m.lines ?? [], lineColors: m.line_colors ?? {},
          stationId: isBus ? null : (m.to_station_id ?? null),
          stopId: isBus ? (m.to_station_id ?? null) : null,
          direction: null,
        })
      }
    }
  }
  nodes.push({ kind: 'dest', label: destination?.label })

  const totalSteps = allSteps.length

  return (
    <div className="mx-3 mb-3 mt-1 overflow-hidden"
      style={{ borderRadius: 6, border: '1px solid #2C2926', background: '#201E1B' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid #2C2926' }}>
        <div className="flex items-center gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: '#8C8884' }}>
            {isSimpleRoute && allSteps.length > 0 ? t('search.steps') : t('search.stepByStep')}
          </p>
          {isSimpleRoute && totalSteps > 0 && (
            <span className="font-mono text-[9px]" style={{ color: '#8C8884' }}>
              {isNavigating
                ? t('search.stepOf', { current: currentStepIndex + 1, total: totalSteps })
                : t('search.steps_count', { count: totalSteps })}
            </span>
          )}
        </div>
        {canNavigate && (
          <button
            onClick={isNavigating ? stopNavigation : startNavigation}
            className="flex items-center gap-1.5 px-2.5 py-1 font-syne text-[10px] font-semibold transition-all"
            style={{
              borderRadius: 5,
              background: isNavigating ? '#D4555518' : '#B8885A',
              border: `1px solid ${isNavigating ? '#D4555544' : '#B8885A'}`,
              color: isNavigating ? '#D45555' : '#fff',
            }}
          >
            {isNavigating ? t('search.stopNav') : t('search.navigate')}
          </button>
        )}
      </div>

      {/* Bicing hint */}
      {showBicingHint && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-lg flex items-start gap-2.5"
          style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)' }}>
          <span className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: '#00ff88' }} />
          <p className="font-mono text-[10px] leading-snug" style={{ color: '#00ff88aa' }}>
            Amb Bicing cobriries els primers {Math.round(firstSeg.duration / 60)} min a peu en ~{Math.round(firstSeg.duration / 60 / 3.5)} min. Considera la ruta Bicing.
          </p>
        </div>
      )}

      {/* Steps */}
      <div className="px-3 py-1.5 max-h-[280px] overflow-y-auto">
        {isSimpleRoute && allSteps.length > 0 ? (
          <NumberedSteps steps={allSteps} currentStep={isNavigating ? currentStepIndex : -1} />
        ) : (
          <div className="flex flex-col py-2 gap-1">
            {nodes.map((node, idx) => {
              if (node.kind === 'origin')   return <StepNodeOrigin   key={idx} label={node.label} />
              if (node.kind === 'dest')     return <StepNodeDest     key={idx} label={node.label} />
              if (node.kind === 'bicing')   return <StepNodeBicing   key={idx} name={node.name} bikes={node.bikes} ebikes={node.ebikes} docks={node.docks} />
              if (node.kind === 'metro')    return <StepNodeMetro    key={idx} name={node.name} lineNames={node.lineNames} lineColors={node.lineColors} stationId={node.stationId} direction={node.direction} />
              if (node.kind === 'bus_stop') return <StepNodeBus      key={idx} name={node.name} lineNames={node.lineNames} lineColors={node.lineColors} stopId={node.stopId} direction={node.direction} />
              if (node.kind === 'transfer') return <StepNodeTransfer key={idx} name={node.name} fromLine={node.fromLine} fromColor={node.fromColor} toLine={node.toLine} toColor={node.toColor} toDirection={node.toDirection} stationId={node.stationId} />
              if (node.kind === 'segment')  return <StepSegment      key={idx} seg={node.seg} />
              return null
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * Sub-componente: campo de texto con sugerencias (Fase opciones)
 * ───────────────────────────────────────────────────────────────────── */

function PointField({ value, onChange, onPickSuggestion, onMyLocation, placeholder, dot, onFocus }) {
  const [focused, setFocused] = useState(false)
  const { results, loading } = useDebouncedSuggestions(focused ? value : '')

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.07] focus-within:border-white/[0.18] transition-colors">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
        <input
          className="flex-1 bg-transparent text-xs font-mono text-white/85 placeholder-white/25 outline-none min-w-0"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && results.length > 0) {
              e.preventDefault()
              onPickSuggestion(results[0])
              e.target.blur()
            }
          }}
          onFocus={() => { setFocused(true); if (onFocus) onFocus(); }}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
        />
        {onMyLocation && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onMyLocation() }}
            title="Mi ubicación"
            className="text-white/30 hover:text-cyan-300 transition-colors flex-shrink-0"
          >
            <Icon.myLocation />
          </button>
        )}
      </div>
      {focused && (
        <div className="absolute top-full left-0 right-0 z-50">
          <SuggestionList
            items={results}
            loading={loading}
            query={value}
            onPick={(s) => onPickSuggestion(s)}
          />
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * Sub-componente: botón de guardar ruta (solo usuarios autenticados)
 * ───────────────────────────────────────────────────────────────────── */

function SaveRouteButton({ originPoint, destPoint, mode }) {
  const isLogged = useAuthStore(s => s.isLogged)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!isLogged) return null

  const handleSave = async () => {
    if (saved || saving || !originPoint || !destPoint) return
    setSaving(true)
    try {
      await addSavedRoute({
        from_lat:   originPoint.lat,
        from_lng:   originPoint.lng,
        from_label: originPoint.label ?? '',
        to_lat:     destPoint.lat,
        to_lng:     destPoint.lng,
        to_label:   destPoint.label ?? '',
        mode,
        name:       destPoint.label ?? '',
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { /* silent */ } finally {
      setSaving(false)
    }
  }

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      title="Guardar ruta"
      className="w-10 flex items-center justify-center transition-all flex-shrink-0"
      style={{
        borderRadius: 6,
        background: saved ? '#B8885A1A' : '#211F1B',
        border: `1px solid ${saved ? '#B8885A' : '#2C2926'}`,
        color: saved ? '#B8885A' : '#8C8884',
      }}
    >
      {saved ? (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      )}
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * Componente principal
 * ───────────────────────────────────────────────────────────────────── */

export default function SearchBar({ embedded = false }) {
  const { t } = useTranslation()
  useRoute()

  const { mapInstance, userLocation, flyTo } = useMapStore()
  const metroLines = useDataStore(s => s.metroLines)

  const {
    mode, setMode,
    origin, destination,
    setOrigin, setDestination,
    route, isLoading,
    setRoute, setLoading, setError,
    clearRoute,
    chatRequest, clearChatRequest,
    setDropdownOpen,
  } = useRouteStore()

  /* Fase interna: 'pill' | 'search' | 'options' */
  const [phase, setPhase] = useState('pill')

  // Sync dropdown visibility to routeStore so SideDrawer/ChatPanel can react
  useEffect(() => { 
    setDropdownOpen(phase !== 'pill')
    if (phase !== 'pill') {
      import('../../store/drawerStore').then(({ useDrawerStore }) => {
        useDrawerStore.getState().close()
      })
    }
  }, [phase])

  /* Inputs */
  const [destQuery,   setDestQuery]   = useState('')
  const [originQuery, setOriginQuery] = useState('')
  const destInputRef = useRef(null)

  /* Punto de origen "actual" (puede ser GPS, BCN center o un lugar elegido) */
  const [originPoint, setOriginPoint] = useState(null)
  /* Destino elegido en Fase search */
  const [destPoint,   setDestPoint]   = useState(null)

  /* Estados de las 4 previews — { foot: {data, loading, error}, ... } */
  const [previews, setPreviews] = useState({})
  const previewVersionRef = useRef(0)
  const planHydratedRef   = useRef(false) // true when previews come from a plan_trip (skip refetch)

  /* ────────────────── Inicialización del origen ────────────────── */

  // Inicializa el origen con GPS cuando está disponible. Sin fallback a BCN center
  // para que el usuario pueda dejar el campo vacío y escribir manualmente.
  useEffect(() => {
    if (originPoint) return
    if (userLocation) {
      setOriginPoint({ lat: userLocation.lat, lng: userLocation.lng, label: 'Mi ubicación' })
    }
  }, [userLocation])

  // Sincroniza el texto del input de origen con originPoint (sólo si el usuario no está escribiendo)
  useEffect(() => {
    if (originPoint?.label) setOriginQuery(originPoint.label)
  }, [originPoint])

  // Sync routeStore origin/destination updates back to local SearchBar state
  // (e.g. when picking a point on the map via MapClickHandler)
  useEffect(() => {
    if (origin && (!originPoint || origin.lat !== originPoint.lat || origin.lng !== originPoint.lng)) {
      setOriginPoint(origin)
      setOriginQuery(origin.label ?? '')
    }
  }, [origin])

  useEffect(() => {
    if (destination && (!destPoint || destination.lat !== destPoint.lat || destination.lng !== destPoint.lng)) {
      setDestPoint(destination)
      setDestQuery(destination.label ?? '')
    }
  }, [destination])

  // Reacts to chat-triggered routes: open options phase with pre-filled data.
  useEffect(() => {
    if (!chatRequest) return
    const { origin: o, destination: d, mode: m, plan } = chatRequest
    if (o) { setOriginPoint(o); setOriginQuery(o.label ?? '') }
    if (d) { setDestPoint(d);   setDestQuery(d.label ?? '') }
    if (m) setMode(m)

    // If a pre-computed plan arrives, hydrate previews directly (avoids refetch)
    if (plan?.options) {
      const { options } = plan
      setPreviews({
        foot:   options.foot   ? { data: options.foot   } : { error: true },
        bicing: options.bicing ? { data: options.bicing } : { error: true },
        metro:  options.metro  ? { data: options.metro  } : { error: true },
        bus:    options.bus    ? { data: options.bus    } : { error: true },
        car:    options.car    ? { data: options.car    } : { error: true },
      })
      planHydratedRef.current = true
    }

    setPhase('options')
    clearChatRequest()
  }, [chatRequest])

  /* ────────────────── Sugerencias en fase search ────────────────── */

  const { results: destSugg, loading: destLoading } = useDebouncedSuggestions(destQuery)

  // Auto-focus al entrar en fase search
  useEffect(() => {
    if (phase === 'search') {
      requestAnimationFrame(() => destInputRef.current?.focus())
    }
  }, [phase])

  /* ────────────────── Cálculo de las 4 previews en paralelo ────────────────── */

  const abortControllerRef = useRef(null)

  const computePreviews = useCallback(async (orig, dest) => {
    if (!orig || !dest) return

    // Cancel any in-flight requests from the previous call
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    const version = ++previewVersionRef.current

    setPreviews({
      foot:   { loading: true },
      bicing: { loading: true },
      metro:  { loading: true },
      bus:    { loading: true },
      car:    { loading: true },
    })

    const requests = MODES.map(m =>
      fetchRoute(orig.lat, orig.lng, dest.lat, dest.lng, m.id)
        .then(data => ({ id: m.id, data }))
        .catch(() => ({ id: m.id, error: true }))
    )

    const results = await Promise.all(requests)

    // Aborta si llegó una versión más nueva mientras tanto
    if (version !== previewVersionRef.current) return
    if (controller.signal.aborted) return

    setPreviews(prev => {
      const next = { ...prev }
      for (const r of results) {
        if (r.error) {
          next[r.id] = { error: true }
        } else if (r.data?.bus_graph_warming) {
          next[r.id] = { error: true, warming: true }
        } else if (r.data?.error) {
          next[r.id] = { error: true }
        } else {
          next[r.id] = { data: r.data }
        }
      }
      return next
    })
  }, [])

  // Cuando cambian origen o destino y estamos en fase 'options', recalcula previews
  useEffect(() => {
    if (phase !== 'options') return
    if (!originPoint || !destPoint) return
    // Skip if previews were just loaded from a plan_trip response
    if (planHydratedRef.current) { planHydratedRef.current = false; return }
    computePreviews(originPoint, destPoint)
  }, [phase, originPoint, destPoint, computePreviews])

  // Sync the active route automatically when its preview completes
  useEffect(() => {
    if (phase !== 'options' || !route) return
    const activePreview = previews[mode]
    if (activePreview?.data && activePreview.data !== route) {
      // Do not overwrite if the user manually selected one of the alternatives
      const isAlternative = activePreview.data.alternatives?.some(alt => alt === route)
      if (!isAlternative) {
        setRoute(activePreview.data)
        setLoading(false)
        setError(null)
      }
    }
  }, [previews, mode, phase, route, setRoute, setLoading, setError])

  /* ────────────────── Acciones ────────────────── */

  const enterSearch = () => {
    setPhase('search')
    setDestQuery('')
  }

  const exitToPill = () => {
    setPhase('pill')
    setDestQuery('')
    setDestPoint(null)
    setPreviews({})
    clearRoute()
  }

  const handlePickDestination = (s) => {
    const point = { lat: s.lat, lng: s.lng, label: s.label }
    setDestPoint(point)
    setDestQuery(s.label)
    setDestination(point)  // show pin on map immediately
    flyTo({ lat: point.lat, lng: point.lng, zoom: 15 })
    setPhase('options')
  }

  const handleMyLocationOrigin = async () => {
    try {
      const pt = await getCurrentLocation()
      setOriginPoint(pt)
      setOriginQuery(pt.label)
    } catch {
      // permiso denegado: deja el punto como estaba
    }
  }

  const handleSwap = () => {
    if (!originPoint || !destPoint) return
    const newOrigin = destPoint
    const newDest   = originPoint
    setOriginPoint(newOrigin)
    setDestPoint(newDest)
    setOriginQuery(newOrigin.label ?? '')
    setDestQuery(newDest.label ?? '')
  }

  const handlePickOriginSuggestion = (s) => {
    const point = { lat: s.lat, lng: s.lng, label: s.label }
    setOriginPoint(point)
    setOriginQuery(s.label)
  }

  const handlePickDestSuggestionInOptions = (s) => {
    const point = { lat: s.lat, lng: s.lng, label: s.label }
    setDestPoint(point)
    setDestQuery(s.label)
    flyTo({ lat: point.lat, lng: point.lng, zoom: 15 })
  }

  const handleActivateMode = async (modeId) => {
    if (!originPoint || !destPoint) return

    // Si ya tenemos los datos, los usamos de inmediato
    const previewData = previews[modeId]?.data
    if (previewData) {
      useRouteStore.getState().setFullRoute(modeId, originPoint, destPoint, previewData)
      return
    }

    // Si se están calculando ahora mismo en computePreviews, solo actualizamos el modo y esperamos.
    // El useEffect de hidratación inyectará la ruta cuando termine computePreviews.
    const isLoadingPreview = previews[modeId]?.loading
    const store = useRouteStore.getState()
    
    if (isLoadingPreview) {
      store.setFullRoute(modeId, originPoint, destPoint, null)
      store.setLoading(true)
      return // No hacemos fetch manual para no pisar el resultado
    }

    // Si falló el preview o no estaba, hacemos fetch manual
    store.setFullRoute(modeId, originPoint, destPoint, null)
    store.setLoading(true)
    try {
      const result = await fetchRoute(originPoint.lat, originPoint.lng, destPoint.lat, destPoint.lng, modeId)
      if (result.error) store.setError(result.error)
      else store.setRoute(result)
    } catch {
      store.setError('No se pudo calcular la ruta. Intenta de nuevo.')
    } finally {
      store.setLoading(false)
    }
  }

  /* ────────────────── Pill collapsada ────────────────── */

  const activeModeMeta = MODE_BY_ID[mode] ?? MODE_BY_ID.foot
  const showActiveInPill = phase === 'pill' && route?.segments?.length > 0

  // Track recommended mode from plan_trip to show IA badge
  const [iaPlanRecommended, setIaPlanRecommended] = React.useState(null)
  React.useEffect(() => {
    if (chatRequest?.plan?.recommended) {
      setIaPlanRecommended(chatRequest.plan.recommended)
    }
  }, [chatRequest])

  /* ────────────────── Compartir ruta ────────────────── */
  const [shareToast, setShareToast] = useState(false)

  const shareRoute = useCallback(() => {
    if (!originPoint || !destPoint) return
    const params = new URLSearchParams({
      from: `${originPoint.lat.toFixed(5)},${originPoint.lng.toFixed(5)}`,
      to:   `${destPoint.lat.toFixed(5)},${destPoint.lng.toFixed(5)}`,
      mode,
      fl:   originPoint.label ?? '',
      tl:   destPoint.label ?? '',
    })
    const url = `${window.location.origin}${window.location.pathname}?${params}`
    navigator.clipboard.writeText(url).then(() => {
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2200)
    })
  }, [originPoint, destPoint, mode])

  const centeredLeft = '50%'

  // Detect when all previews have loaded with errors → show retry button (used in both embedded and floating)
  const allFailed = Object.keys(previews).length === MODES.length &&
    MODES.every(m => previews[m.id]?.error === true)

  /* ────────────────── Render embegut (TopBar) ────────────────── */

  if (embedded) {
    // Dropdown anchored to left edge — same position as SideDrawer (left-3, top-14).
    const dropdownStyle = {
      position: 'absolute',
      top: 60,   // 56px topbar + 4px gap
      left: 12,
      zIndex: 60,
    }

    // Share icon paths (not a component — avoids remount on every render)
    const shareIconContent = shareToast
      ? <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      : <><circle cx="12.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="12.5" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="3.5" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/><line x1="5.4" y1="7" x2="10.6" y2="4.4" stroke="currentColor" strokeWidth="1.3"/><line x1="5.4" y1="9" x2="10.6" y2="11.6" stroke="currentColor" strokeWidth="1.3"/></>

    // Options dropdown content — inlined, NOT a sub-component, to avoid remount on every keystroke.
    // Uses flex-column layout: fixed PointFields header + scrollable body + sticky CTA footer.
    const optionsDropdownJSX = (
      <div className="shadow-[0_8px_40px_rgba(0,0,0,0.7)]"
        style={{ background: '#151210', border: '1px solid #2C2926', borderRadius: 8,
                 maxHeight: 'calc(100dvh - 80px)', display: 'flex', flexDirection: 'column' }}
      >
        {/* ── HEADER: PointFields — always visible, suggestions can overflow below ── */}
        <div className="px-3 pt-3 pb-2 flex flex-col gap-2"
          style={{ borderBottom: '1px solid #201E1B', flexShrink: 0,
                   position: 'relative', zIndex: 5, background: '#151210' }}
        >
          <PointField value={originQuery} onChange={v => { setOriginQuery(v); if (!v) setOriginPoint(null) }}
            onPickSuggestion={handlePickOriginSuggestion} onMyLocation={handleMyLocationOrigin}
            placeholder={t('search.origin')} dot="#00b4ff" onFocus={() => useRouteStore.getState().setPicking('origin')}
          />
          <div className="flex items-center gap-2 px-1">
            <div className="flex-1 h-px" style={{ background: '#2C2926' }} />
            <button onClick={handleSwap} title={t('search.swap')} className="transition-colors" style={{ color: '#8C8884' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F7F6F4' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#8C8884' }}
            ><Icon.swap size={14} /></button>
            <div className="flex-1 h-px" style={{ background: '#2C2926' }} />
          </div>
          <PointField value={destQuery} onChange={v => { setDestQuery(v); if (!v) setDestPoint(null) }}
            onPickSuggestion={handlePickDestSuggestionInOptions}
            placeholder={t('search.destination')} dot="#ff6b35" onFocus={() => useRouteStore.getState().setPicking('destination')}
          />
        </div>

        {/* ── BODY: scrollable mode cards + step panel ── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div className="px-3 py-3 flex flex-col gap-1.5">
            {MODES.map(m => (
              <ModeCard key={m.id}
                mode={{ ...m, isRecommended: iaPlanRecommended === m.id }}
                state={previews[m.id]}
                isActive={mode === m.id && route?.segments?.length > 0}
                onClick={() => handleActivateMode(m.id)}
                onPickAlternative={(alt) => useRouteStore.getState().setFullRoute(m.id, originPoint, destPoint, alt)}
                metroLines={metroLines}
              />
            ))}
            {/* Retry button when all modes fail */}
            {allFailed && originPoint && destPoint && (
              <button
                onClick={() => computePreviews(originPoint, destPoint)}
                className="w-full flex items-center justify-center gap-2 py-2 mt-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors"
                style={{ borderRadius: 6, border: '1px solid #2C2926', color: '#B0ACA7', background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#F7F6F4'; e.currentTarget.style.borderColor = '#8C8884' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#B0ACA7'; e.currentTarget.style.borderColor = '#6B6865' }}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M8 0.5L10.5 2.5L8 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('search.retry') ?? 'Reintentar'}
              </button>
            )}
          </div>
          {/* Step panel */}
          {route?.segments?.length > 0 && (
            <RouteStepPanel segments={route.segments} origin={originPoint} destination={destPoint} mode={mode} />
          )}
          {/* Loading */}
          {isLoading && (
            <div className="px-3 pb-3">
              <div className="flex items-center gap-2 px-3 py-2" style={{ borderRadius: 6, background: '#211F1B' }}>
                {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#B8885A', animationDelay: `${d}ms` }} />)}
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] ml-1" style={{ color: '#8C8884' }}>{t('search.calculating')}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER: CTA — always visible at bottom ── */}
        {route?.segments?.length > 0 && !isLoading && (
          <div className="px-3 py-2.5 flex gap-2 md:hidden"
            style={{ flexShrink: 0, borderTop: '1px solid #201E1B' }}
          >
            <button onClick={() => setPhase('pill')}
              className="flex-1 px-3 py-2.5 font-syne text-[12px] font-semibold"
              style={{ borderRadius: 6, color: '#fff', background: '#B8885A', border: '1px solid #B8885A' }}
            >Veure al mapa →</button>
            <SaveRouteButton originPoint={originPoint} destPoint={destPoint} mode={mode} />
          </div>
        )}
      </div>
    )

    const pillCard = {
      background:   '#151210',
      border:       '1px solid #2C2926',
      borderRadius: 8,
      boxShadow:    '0 2px 16px rgba(0,0,0,0.55)',
    }

    const barTransition = { duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }
    const barWidth = phase === 'pill' ? 300 : 380
    const barBorderColor = phase === 'options' && showActiveInPill
      ? activeModeMeta.color + '55'
      : '#2C2926'

    return (
      <>
        {/* ── Persistent bar — CSS-transitions width, cross-fades content ── */}
        <div
          className="flex items-center px-3 h-11 overflow-hidden"
          style={{
            ...pillCard,
            width: barWidth,
            borderColor: barBorderColor,
            transition: 'width 180ms cubic-bezier(0.4,0,0.2,1), border-color 180ms',
          }}
        >
          {phase === 'pill' && (
            <motion.div className="flex items-center gap-2.5 w-full min-w-0"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.1, delay: 0.06 }}>
              <button
                onClick={showActiveInPill ? () => setPhase('options') : enterSearch}
                className="flex-1 flex items-center gap-2.5 min-w-0 h-full"
              >
                {showActiveInPill ? (
                  <>
                    <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: activeModeMeta.color }} />
                    <span className="font-syne text-[13px] font-medium truncate flex-1 text-left" style={{ color: '#F7F6F4' }}>
                      {destPoint?.label ?? destination?.label ?? 'Destí'}
                    </span>
                    <span className="font-syne text-[13px] font-semibold flex-shrink-0" style={{ color: activeModeMeta.color }}>
                      {fmtTime(route.duration)}
                    </span>
                  </>
                ) : (
                  <>
                    <Icon.search size={14} style={{ color: '#7D7975', flexShrink: 0 }} />
                    <span className="font-syne text-[13px]" style={{ color: '#8C8884' }}>{t('search.placeholder')}</span>
                  </>
                )}
              </button>
              {showActiveInPill && (
                <>
                  <div className="w-px h-5 flex-shrink-0" style={{ background: '#2C2926' }} />
                  <button onClick={shareRoute} title="Copiar enllaç"
                    className="w-8 h-8 flex items-center justify-center rounded-md transition-all flex-shrink-0"
                    style={{ color: shareToast ? '#B8885A' : '#8C8884', background: shareToast ? '#B8885A1A' : 'transparent' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">{shareIconContent}</svg>
                  </button>
                </>
              )}
            </motion.div>
          )}

          {phase === 'search' && (
            <motion.div className="flex items-center gap-2.5 w-full min-w-0"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.1, delay: 0.08 }}>
              <button onClick={exitToPill} className="flex items-center justify-center flex-shrink-0 transition-colors" style={{ color: '#8C8884' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#F7F6F4' }} onMouseLeave={e => { e.currentTarget.style.color = '#8C8884' }}
              ><Icon.back size={14} /></button>
              <div className="w-px h-5 flex-shrink-0" style={{ background: '#2C2926' }} />
              <Icon.search size={13} style={{ color: '#7D7975', flexShrink: 0 }} />
              <input
                ref={destInputRef}
                className="flex-1 bg-transparent outline-none font-syne text-[13px] min-w-0"
                style={{ color: '#F7F6F4' }}
                placeholder={t('search.placeholder')}
                value={destQuery}
                onChange={e => setDestQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') exitToPill()
                  if (e.key === 'Enter' && destSugg[0]) handlePickDestination(destSugg[0])
                }}
              />
              {destQuery && (
                <button onMouseDown={e => { e.preventDefault(); setDestQuery('') }} style={{ color: '#8C8884', flexShrink: 0 }}>
                  <Icon.close size={11} />
                </button>
              )}
            </motion.div>
          )}

          {phase === 'options' && (
            <motion.div className="flex items-center gap-2 w-full min-w-0"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.1, delay: 0.08 }}>
              <button onClick={() => setPhase('search')} className="flex items-center justify-center flex-shrink-0 transition-colors" style={{ color: '#8C8884' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#F7F6F4' }} onMouseLeave={e => { e.currentTarget.style.color = '#8C8884' }}
              ><Icon.back size={14} /></button>
              <div className="w-px h-5 flex-shrink-0" style={{ background: '#2C2926' }} />
              <div className="flex-1 min-w-0">
                <p className="font-syne text-[13px] font-medium truncate" style={{ color: '#F7F6F4' }}>{destPoint?.label ?? '—'}</p>
                {showActiveInPill && (
                  <p className="font-mono text-[9px] leading-none mt-0.5" style={{ color: activeModeMeta.color }}>
                    {activeModeMeta.label} · {fmtTime(route.duration)}
                  </p>
                )}
              </div>
              <button onClick={shareRoute} title="Copiar enllaç"
                className="w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-md transition-colors"
                style={{ color: shareToast ? '#B8885A' : '#8C8884', background: shareToast ? '#B8885A1A' : 'transparent' }}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">{shareIconContent}</svg>
              </button>
              <button onClick={exitToPill} className="w-8 h-8 flex items-center justify-center flex-shrink-0 transition-colors rounded-md" style={{ color: '#8C8884' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#F7F6F4' }} onMouseLeave={e => { e.currentTarget.style.color = '#8C8884' }}
              ><Icon.close size={11} /></button>
            </motion.div>
          )}
        </div>

        {/* ── Dropdowns — fade in below bar ── */}
        <AnimatePresence>
          {phase === 'search' && (destLoading || destSugg.length > 0) && (
            <motion.div
              key="suggestions-dropdown"
              style={{ ...dropdownStyle, width: 380, maxWidth: 'calc(100vw - 24px)' }}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <div style={{ background: '#151210', border: '1px solid #2C2926', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
                <SuggestionList items={destSugg} loading={destLoading} query={destQuery} onPick={handlePickDestination} />
              </div>
            </motion.div>
          )}
          {phase === 'options' && (
            <motion.div
              key="options-dropdown"
              style={{ ...dropdownStyle, width: 380, maxWidth: 'calc(100vw - 24px)' }}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {optionsDropdownJSX}
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )
  }

  /* ────────────────── Render flotant (legacy, no s'usa quan embedded) ────────────────── */

  return (
    <>
      {/* ─── Pill ─── */}
      <AnimatePresence>
        {phase === 'pill' && (
          <motion.div
            key="pill"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="absolute top-4 -translate-x-1/2 z-40 flex items-center gap-1"
            style={{ left: centeredLeft }}
          >
            <button
              onClick={showActiveInPill ? () => setPhase('options') : enterSearch}
              className="flex items-center gap-2.5 px-4 py-2.5 transition-all"
              style={{
                background: '#151210',
                border: `1px solid ${showActiveInPill ? activeModeMeta.color + '66' : '#2C2926'}`,
                borderRadius: 8,
                boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
              }}
            >
              {showActiveInPill ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: activeModeMeta.color }} />
                  <span className="font-syne text-[12px] font-medium truncate max-w-[180px]" style={{ color: '#F7F6F4' }}>
                    {destPoint?.label ?? destination?.label ?? 'Destí'}
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: '#6B6865' }}>·</span>
                  <span className="font-syne text-[13px] font-semibold" style={{ color: activeModeMeta.color }}>
                    {fmtTime(route.duration)}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ color: '#8C8884' }}><Icon.search /></span>
                  <span className="font-syne text-[12px]" style={{ color: '#B0ACA7' }}>{t('search.placeholder')}</span>
                </>
              )}
            </button>

            {/* Share button — only when route is active */}
            {showActiveInPill && (
              <button
                onClick={shareRoute}
                title="Copiar enlace"
                className="w-9 h-9 flex items-center justify-center transition-all"
                style={{
                  background: shareToast ? '#B8885A1A' : '#151210',
                  border: `1px solid ${shareToast ? '#B8885A' : '#2C2926'}`,
                  borderRadius: 8,
                  color: shareToast ? '#B8885A' : '#8C8884',
                }}
              >
                {shareToast ? (
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8 L6.5 11.5 L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <circle cx="12.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
                    <circle cx="12.5" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
                    <circle cx="3.5" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
                    <line x1="5.4" y1="7" x2="10.6" y2="4.4" stroke="currentColor" strokeWidth="1.3"/>
                    <line x1="5.4" y1="9" x2="10.6" y2="11.6" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                )}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Fase: SEARCH (campo único de destino) ─── */}
      <AnimatePresence>
        {phase === 'search' && (
          <motion.div
            key="phase-search"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
            className="absolute top-4 -translate-x-1/2 z-40 w-[420px] max-w-[92vw]"
            style={{ left: centeredLeft }}
          >
            <div className="p-3" style={{ background: '#151210', border: '1px solid #2C2926', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
              <div className="flex items-center gap-2">
                <button
                  onClick={exitToPill}
                  title="Cerrar"
                  className="w-8 h-8 flex items-center justify-center transition-colors flex-shrink-0"
                  style={{ borderRadius: 6, background: '#211F1B', border: '1px solid #2C2926', color: '#8C8884' }}
                >
                  <Icon.close />
                </button>
                <div className="flex items-center gap-2 flex-1 px-3 py-2 transition-colors"
                  style={{ borderRadius: 6, background: '#211F1B', border: '1px solid #2C2926' }}
                >
                  <span style={{ color: '#8C8884' }}><Icon.search /></span>
                  <input
                    ref={destInputRef}
                    className="flex-1 bg-transparent outline-none min-w-0 font-mono text-[13px]"
                    style={{ color: '#F7F6F4' }}
                    placeholder={t('search.placeholder')}
                    value={destQuery}
                    onChange={e => setDestQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') exitToPill()
                      if (e.key === 'Enter' && destSugg[0]) handlePickDestination(destSugg[0])
                    }}
                  />
                  {destQuery && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setDestQuery('') }}
                      className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0"
                    >
                      <Icon.close size={12} />
                    </button>
                  )}
                </div>
              </div>

              <SuggestionList
                items={destSugg}
                loading={destLoading}
                query={destQuery}
                onPick={handlePickDestination}
              />

              {!destQuery && (
                <div className="mt-3 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: '#8C8884' }}>
                  Escriu una adreça, restaurant o lloc de Barcelona
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Fase: OPTIONS (4 tarjetas de modo) ─── */}
      <AnimatePresence>
        {phase === 'options' && (
          <motion.div
            key="phase-options"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
            className="absolute top-4 -translate-x-1/2 z-40 w-[440px] max-w-[94vw]"
            style={{ left: centeredLeft }}
          >
            <div className="shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
              style={{ background: '#151210', border: '1px solid #2C2926', borderRadius: 8,
                       maxHeight: 'calc(100dvh - 80px)', display: 'flex', flexDirection: 'column' }}
            >
              {/* ── HEADER: fixed — back/close + PointFields, suggestions overflow below ── */}
              <div style={{ flexShrink: 0, position: 'relative', zIndex: 5, background: '#151210' }}>
                {/* Destination label row */}
                <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid #2C2926' }}>
                  <button
                    onClick={() => setPhase('search')}
                    title="Volver a la búsqueda"
                    className="w-7 h-7 flex items-center justify-center transition-colors flex-shrink-0"
                    style={{ borderRadius: 6, color: '#8C8884' }}
                  >
                    <Icon.back />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[8px] uppercase tracking-[0.14em]" style={{ color: '#8C8884' }}>Destí</p>
                    <p className="font-syne text-[13px] font-medium truncate" style={{ color: '#F7F6F4' }}>{destPoint?.label ?? '—'}</p>
                  </div>
                  <button
                    onClick={exitToPill}
                    title="Cerrar"
                    className="w-7 h-7 flex items-center justify-center transition-colors flex-shrink-0"
                    style={{ borderRadius: 6, color: '#8C8884' }}
                  >
                    <Icon.close />
                  </button>
                </div>

                {/* Inputs origen / destino editables + swap */}
                <div className="px-3 pt-3 pb-2 flex flex-col gap-2" style={{ borderBottom: '1px solid #201E1B' }}>
                  <PointField
                    value={originQuery}
                    onChange={(v) => {
                      setOriginQuery(v)
                      if (!v) setOriginPoint(null)
                    }}
                    onPickSuggestion={handlePickOriginSuggestion}
                    onMyLocation={handleMyLocationOrigin}
                    placeholder={t('search.origin')}
                    dot="#00b4ff"
                  />

                  <div className="flex items-center gap-2 px-1">
                    <div className="flex-1 h-px bg-white/[0.05]" />
                    <button
                      onClick={handleSwap}
                      title="Intercambiar origen y destino"
                      className="text-white/30 hover:text-white/80 transition-colors"
                    >
                      <Icon.swap />
                    </button>
                    <div className="flex-1 h-px bg-white/[0.05]" />
                  </div>

                  <PointField
                    value={destQuery}
                    onChange={(v) => {
                      setDestQuery(v)
                      if (!v) setDestPoint(null)
                    }}
                    onPickSuggestion={handlePickDestSuggestionInOptions}
                    placeholder={t('search.destination')}
                    dot="#ff6b35"
                  />
                </div>
              </div>

              {/* ── BODY: scrollable — mode cards + step panel + loading ── */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {/* Tarjetas de modo */}
                <div className="px-3 pb-3 pt-3 flex flex-col gap-1.5">
                  {MODES.map(m => (
                    <ModeCard
                      key={m.id}
                      mode={{ ...m, isRecommended: iaPlanRecommended === m.id }}
                      state={previews[m.id]}
                      isActive={mode === m.id && route?.segments?.length > 0}
                      onClick={() => handleActivateMode(m.id)}
                      metroLines={metroLines}
                    />
                  ))}
                  {/* Retry button when all modes fail */}
                  {allFailed && originPoint && destPoint && (
                    <button
                      onClick={() => computePreviews(originPoint, destPoint)}
                      className="w-full flex items-center justify-center gap-2 py-2 mt-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors"
                      style={{ borderRadius: 6, border: '1px solid #2C2926', color: '#B0ACA7', background: 'transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#F7F6F4'; e.currentTarget.style.borderColor = '#8C8884' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#B0ACA7'; e.currentTarget.style.borderColor = '#6B6865' }}
                    >
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                        <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        <path d="M8 0.5L10.5 2.5L8 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {t('search.retry') ?? 'Reintentar'}
                    </button>
                  )}
                </div>

                {/* Panel detallado paso a paso */}
                {route?.segments?.length > 0 && (
                  <RouteStepPanel
                    segments={route.segments}
                    origin={originPoint}
                    destination={destPoint}
                    mode={mode}
                  />
                )}

                {/* Estado calculando */}
                {isLoading && (
                  <div className="px-3 pb-3">
                    <div className="flex items-center gap-2 px-3 py-2" style={{ borderRadius: 6, background: '#211F1B' }}>
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#B8885A', animationDelay: `${d}ms` }} />
                      ))}
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] ml-1" style={{ color: '#8C8884' }}>{t('search.calculating')}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── FOOTER: CTA — always visible at bottom ── */}
              {route?.segments?.length > 0 && !isLoading && (
                <div className="px-3 py-2.5 flex gap-2 md:hidden"
                  style={{ flexShrink: 0, borderTop: '1px solid #201E1B' }}
                >
                  <button
                    onClick={() => { setPhase('pill') }}
                    className="flex-1 px-3 py-2.5 font-syne text-[12px] font-semibold transition-colors"
                    style={{
                      borderRadius: 6,
                      color: '#fff',
                      background: '#B8885A',
                      border: '1px solid #B8885A',
                    }}
                  >
                    Veure al mapa →
                  </button>
                  <SaveRouteButton
                    originPoint={originPoint}
                    destPoint={destPoint}
                    mode={mode}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
