import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouteStore } from '../../store/routeStore'
import { useMapStore } from '../../store/mapStore'
import { useDataStore } from '../../store/dataStore'
import { useRoute } from '../../hooks/useRoute'
import { fetchRoute, fetchMetroArrivals } from '../../services/api'
import { geocodeSearch } from '../../utils/geocode'

/* ─────────────────────────────────────────────────────────────────────
 * Constantes
 * ───────────────────────────────────────────────────────────────────── */

const BCN_CENTER = { lat: 41.3851, lng: 2.1734, label: 'Centro de Barcelona' }

const MODES = [
  { id: 'foot',   label: 'A pie',  color: '#ffffff' },
  { id: 'bicing', label: 'Bicing', color: '#00ff88' },
  { id: 'bus',    label: 'Metro',  color: '#ff6b35' },
  { id: 'car',    label: 'Coche',  color: '#ffaa00' },
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
  // Modo: metro/tren
  bus: (p) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" style={p.style}>
      <rect x="5" y="3" width="14" height="15" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="5" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8.5" cy="14.5" r="1.1" fill="currentColor" />
      <circle cx="15.5" cy="14.5" r="1.1" fill="currentColor" />
      <path d="M7 18 L5 21 M17 18 L19 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
  car:    Icon.car,
  bus:    Icon.bus,
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
    const t = setTimeout(async () => {
      const r = await geocodeSearch(query)
      setResults(r)
      setLoading(false)
    }, delay)
    return () => clearTimeout(t)
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
                const lineRec = lineLookup(ln)
                return <MetroLineBadge key={k} name={ln} color={lineRec?.color} />
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

function ModeCard({ mode, state, isActive, onClick, metroLines }) {
  const ModeIcon = MODE_ICONS[mode.id]
  const { color } = mode
  const data    = state?.data
  const loading = state?.loading
  const failed  = state?.error

  const segs = data?.segments ?? []

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
  } else if (mode.id === 'bus' && segs.length) {
    const metroSegs = segs.filter(s => s.type === 'metro' || s.type === 'bus')
    if (metroSegs.length > 1) {
      const lines = metroSegs.map(s => s.meta?.lines?.[0]).filter(Boolean)
      metaLine = <span>{lines.join(' → ')}</span>
    } else if (metroSegs[0]?.meta?.from_station) {
      const m = metroSegs[0].meta
      metaLine = <span>{m.from_station} → {m.to_station}</span>
    }
  }

  const trafficNote = mode.id === 'car' ? (data?.traffic?.note ?? data?.segments?.[0]?.meta?.traffic_note) : null
  const congestion  = mode.id === 'car' ? (data?.traffic?.congestion ?? data?.segments?.[0]?.meta?.congestion) : null
  const trafficColor = congestion >= 80 ? '#ff3333' : congestion >= 60 ? '#ffcc00' : '#00ff88'

  return (
    <motion.button
      layout
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      className={`w-full text-left rounded-xl border transition-all overflow-hidden
        ${isActive
          ? 'border-white/30 bg-white/[0.05]'
          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12]'}`}
      style={isActive ? { boxShadow: `inset 0 0 0 1px ${color}55, 0 0 18px ${color}22`, borderColor: color + '55' } : undefined}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
          style={{
            color,
            background: isActive ? color + '22' : 'rgba(255,255,255,0.04)',
            boxShadow: isActive ? `0 0 12px ${color}55, inset 0 0 0 1px ${color}66` : undefined,
          }}
        >
          <ModeIcon size={20} />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: isActive ? color : 'rgba(255,255,255,0.55)' }}>
              {mode.label}
            </span>
            {data && (
              <span className="text-xs font-mono font-medium" style={{ color: isActive ? color : 'rgba(255,255,255,0.9)' }}>
                {fmtTime(data.duration)}
              </span>
            )}
            {loading && (
              <span className="flex items-center gap-1">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1 h-1 rounded-full animate-bounce" style={{ background: color, animationDelay: `${d}ms` }} />
                ))}
              </span>
            )}
            {failed && <span className="text-[10px] font-mono text-white/30">No disponible</span>}
          </div>

          {data && segs.length > 0 && (
            <div className="mt-1.5">
              <SegmentSequence segments={segs} metroLines={metroLines} />
            </div>
          )}
          {data && (
            <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-white/35">
              {data.distance != null && <span>{fmtDist(data.distance)}</span>}
              {trafficNote && (
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ color: trafficColor, background: trafficColor + '18' }}>
                  {trafficNote}
                </span>
              )}
              {!trafficNote && metaLine && <span className="truncate">· {metaLine}</span>}
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

  useEffect(() => {
    if (!stationId) { setData({ loading: false, trains: null }); return }
    let cancelled = false

    const load = async () => {
      setData(prev => ({ loading: prev.trains == null, trains: prev.trains }))
      try {
        const r = await fetchMetroArrivals(stationId)
        if (cancelled) return
        const trains = Array.isArray(r?.trains) ? r.trains : null
        setData({ loading: false, trains })
      } catch {
        if (cancelled) return
        setData({ loading: false, trains: null })
      }
    }

    load()
    const t = setInterval(load, 60000)
    return () => { cancelled = true; clearInterval(t) }
  }, [stationId])

  return data
}

/* ─────────────────────────────────────────────────────────────────────
 * Sub-componente: nodo de estación dentro del timeline de RouteStepPanel
 * ───────────────────────────────────────────────────────────────────── */

function MetroArrivalsLine({ stationId, lines }) {
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

  // Filtra a las líneas que nos interesan si están definidas
  const filtered = lines?.length
    ? trains.filter(t => lines.includes(t.line))
    : trains
  const pool = filtered.length ? filtered : trains
  const upcoming = pool.slice(0, 2)
  if (!upcoming.length) return null

  const label = upcoming
    .map(t => (t.minutes === 0 ? 'ahora' : `${t.minutes} min`))
    .join(' · ')

  return (
    <span className="text-cyan-400/70 text-[10px] font-mono">
      Próximo: {label}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * Sub-componente: panel detallado de pasos de la ruta activa (timeline)
 * ───────────────────────────────────────────────────────────────────── */

function StepNodeOrigin({ label }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[22px] flex justify-center flex-shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-white border border-white/40" />
      </span>
      <span className="text-[12px] font-mono text-white/80 truncate">
        {label ?? 'Mi ubicación'}
      </span>
    </div>
  )
}

function StepNodeDest({ label }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[22px] flex justify-center flex-shrink-0">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: '#ff6b35', boxShadow: '0 0 6px #ff6b3577' }}
        />
      </span>
      <span className="text-[12px] font-mono text-white/80 truncate">
        {label ?? 'Destino'}
      </span>
    </div>
  )
}

function StepNodeBicing({ name, bikes, ebikes, docks }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-[22px] flex justify-center flex-shrink-0 mt-0.5">
        <span
          className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[#00ff88]"
          style={{
            background: 'rgba(0,255,136,0.08)',
            boxShadow: '0 0 6px rgba(0,255,136,0.45), inset 0 0 0 1px rgba(0,255,136,0.55)',
          }}
        >
          <Icon.segBike size={10} />
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-mono text-white/80 truncate">{name}</p>
        <p className="text-[10px] font-mono text-white/40">
          {bikes != null && <span>{bikes} {bikes === 1 ? 'bici' : 'bicis'}</span>}
          {ebikes != null && bikes != null && <span> · </span>}
          {ebikes != null && <span>{ebikes} {ebikes === 1 ? 'e-bici' : 'e-bicis'}</span>}
          {docks != null && (bikes != null || ebikes != null) && <span> · </span>}
          {docks != null && <span>{docks} {docks === 1 ? 'muelle libre' : 'muelles libres'}</span>}
        </p>
      </div>
    </div>
  )
}

function StepNodeMetro({ name, lineNames, lineColors, stationId }) {
  const primary = lineNames?.[0]
  const primaryColor = primary && lineColors?.[primary] ? lineColors[primary] : '#A855F7'
  const bg = primaryColor.startsWith('#') ? primaryColor : '#' + primaryColor

  return (
    <div className="flex items-start gap-2.5">
      <span className="w-[22px] flex justify-center flex-shrink-0 mt-0.5">
        <span
          className="inline-flex items-center justify-center min-w-[22px] h-[18px] px-1 rounded text-[9px] font-mono font-bold text-white"
          style={{ background: bg, boxShadow: `0 0 6px ${bg}88` }}
        >
          {primary ?? 'M'}
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-mono text-white/80 truncate">{name}</p>
        {stationId && (
          <p className="mt-0.5">
            <MetroArrivalsLine stationId={stationId} lines={lineNames} />
          </p>
        )}
      </div>
    </div>
  )
}

function StepNodeTransfer({ name, fromLine, fromColor, toLine, toColor, stationId }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-[22px] flex justify-center flex-shrink-0 mt-0.5">
        <span className="flex items-center gap-0.5">
          <span
            className="inline-flex items-center justify-center min-w-[18px] h-[15px] px-1 rounded text-[8px] font-mono font-bold text-white"
            style={{ background: fromColor ?? '#888', boxShadow: `0 0 4px ${fromColor ?? '#888'}88` }}
          >
            {fromLine ?? 'M'}
          </span>
          <span className="text-white/30 text-[8px]">→</span>
          <span
            className="inline-flex items-center justify-center min-w-[18px] h-[15px] px-1 rounded text-[8px] font-mono font-bold text-white"
            style={{ background: toColor ?? '#888', boxShadow: `0 0 4px ${toColor ?? '#888'}88` }}
          >
            {toLine ?? 'M'}
          </span>
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-mono text-white/80 truncate">{name}</p>
        <p className="text-[10px] font-mono text-white/35">Transbordo</p>
        {stationId && (
          <p className="mt-0.5">
            <MetroArrivalsLine stationId={stationId} lines={[toLine].filter(Boolean)} />
          </p>
        )}
      </div>
    </div>
  )
}

function StepSegment({ seg }) {
  const SegIcon = SEG_ICONS[seg.type]
  const isWalk  = seg.type === 'walk'
  const isBike  = seg.type === 'bike'
  const isMetro = seg.type === 'metro'
  const isBus   = seg.type === 'bus'
  const isCar   = seg.type === 'drive'

  let label = 'Tramo'
  if (isWalk)  label = 'A pie'
  else if (isBike)  label = 'Bicing'
  else if (isCar)   label = 'Coche'
  else if (isMetro) {
    const ln = seg.meta?.lines?.[0]
    label = ln ? `Metro ${ln}` : 'Metro'
  }
  else if (isBus) label = 'Bus'

  const color = seg.color ?? '#ffffff'

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="w-[22px] flex justify-center flex-shrink-0">
        <span
          className="w-px h-5"
          style={{ background: color + '55' }}
        />
      </span>
      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono" style={{ color }}>
        {SegIcon && <SegIcon />}
        <span>{label}</span>
        <span className="text-white/30">·</span>
        <span className="text-white/55">{fmtTime(seg.duration)}</span>
        {seg.distance != null && (
          <>
            <span className="text-white/30">·</span>
            <span className="text-white/40">{fmtDist(seg.distance)}</span>
          </>
        )}
      </span>
    </div>
  )
}

function RouteStepPanel({ segments, origin, destination }) {
  if (!segments?.length) return null

  /* Construye la secuencia de nodos intercalados con segmentos. */
  const nodes = []
  // Nodo de origen al inicio
  nodes.push({ kind: 'origin', label: origin?.label })

  for (let i = 0; i < segments.length; i++) {
    const seg  = segments[i]
    const next = segments[i + 1]
    nodes.push({ kind: 'segment', seg })

    // Nodo intermedio entre dos segmentos: estación
    if (next) {
      // Bicing: walk → bike (estación de recogida), bike → walk (estación de devolución)
      if (seg.type === 'walk' && next.type === 'bike') {
        const m = next.meta ?? {}
        nodes.push({
          kind: 'bicing',
          name: m.from_station ?? 'Estación Bicing',
          bikes: m.bikes_available,
          ebikes: m.ebikes_available,
          docks: null,
        })
      } else if (seg.type === 'bike' && next.type === 'walk') {
        const m = seg.meta ?? {}
        nodes.push({
          kind: 'bicing',
          name: m.to_station ?? 'Estación Bicing',
          bikes: null,
          ebikes: null,
          docks: m.docks_available,
        })
      } else if (seg.type === 'walk' && (next.type === 'metro' || next.type === 'bus')) {
        const m = next.meta ?? {}
        nodes.push({
          kind: 'metro',
          name: m.from_station ?? 'Estación',
          lineNames: m.lines ?? [],
          lineColors: m.line_colors ?? {},
          stationId: m.from_station_id ?? null,
        })
      } else if ((seg.type === 'metro' || seg.type === 'bus') && (next.type === 'metro' || next.type === 'bus')) {
        // Transfer between lines: to_station of current leg = from_station of next
        const m = seg.meta ?? {}
        nodes.push({
          kind: 'transfer',
          name: m.to_station ?? 'Transbordo',
          fromLine: seg.meta?.lines?.[0],
          fromColor: seg.color,
          toLine: next.meta?.lines?.[0],
          toColor: next.color,
          stationId: m.to_station_id ?? null,
        })
      } else if ((seg.type === 'metro' || seg.type === 'bus') && next.type === 'walk') {
        const m = seg.meta ?? {}
        nodes.push({
          kind: 'metro',
          name: m.to_station ?? 'Estación',
          lineNames: m.lines ?? [],
          lineColors: m.line_colors ?? {},
          stationId: null,
        })
      }
    }
  }

  // Nodo de destino al final
  nodes.push({ kind: 'dest', label: destination?.label })

  return (
    <div className="mx-3 mb-3 mt-1 rounded-xl bg-white/[0.02] border border-white/[0.05] p-3 max-h-[280px] overflow-y-auto">
      <p className="text-[9px] font-mono uppercase tracking-wider text-white/35 mb-2.5">
        Paso a paso
      </p>
      <div className="flex flex-col">
        {nodes.map((node, idx) => {
          if (node.kind === 'origin')  return <StepNodeOrigin  key={idx} label={node.label} />
          if (node.kind === 'dest')    return <StepNodeDest    key={idx} label={node.label} />
          if (node.kind === 'bicing')  return (
            <StepNodeBicing
              key={idx}
              name={node.name}
              bikes={node.bikes}
              ebikes={node.ebikes}
              docks={node.docks}
            />
          )
          if (node.kind === 'metro')   return (
            <StepNodeMetro
              key={idx}
              name={node.name}
              lineNames={node.lineNames}
              lineColors={node.lineColors}
              stationId={node.stationId}
            />
          )
          if (node.kind === 'transfer') return (
            <StepNodeTransfer
              key={idx}
              name={node.name}
              fromLine={node.fromLine}
              fromColor={node.fromColor}
              toLine={node.toLine}
              toColor={node.toColor}
              stationId={node.stationId}
            />
          )
          if (node.kind === 'segment') return <StepSegment key={idx} seg={node.seg} />
          return null
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * Sub-componente: campo de texto con sugerencias (Fase opciones)
 * ───────────────────────────────────────────────────────────────────── */

function PointField({ value, onChange, onPickSuggestion, onMyLocation, placeholder, dot }) {
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
          onFocus={() => setFocused(true)}
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
 * Componente principal
 * ───────────────────────────────────────────────────────────────────── */

export default function SearchBar() {
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
  } = useRouteStore()

  /* Fase interna: 'pill' | 'search' | 'options' */
  const [phase, setPhase] = useState('pill')

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

  /* ────────────────── Inicialización del origen ────────────────── */

  // Inicializa el origen con GPS si está disponible, sino con el centro de Barcelona.
  useEffect(() => {
    if (originPoint) return
    if (userLocation) {
      setOriginPoint({ lat: userLocation.lat, lng: userLocation.lng, label: 'Mi ubicación' })
    } else {
      setOriginPoint({ ...BCN_CENTER })
    }
  }, [userLocation, originPoint])

  // Sincroniza el texto del input de origen con originPoint (sólo si el usuario no está escribiendo)
  useEffect(() => {
    if (originPoint?.label) setOriginQuery(originPoint.label)
  }, [originPoint])

  // Reacts to chat-triggered routes: open options phase with pre-filled data.
  useEffect(() => {
    if (!chatRequest) return
    const { origin: o, destination: d, mode: m } = chatRequest
    if (o) { setOriginPoint(o); setOriginQuery(o.label ?? '') }
    if (d) { setDestPoint(d);   setDestQuery(d.label ?? '') }
    if (m) setMode(m)
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

  const computePreviews = useCallback(async (orig, dest) => {
    if (!orig || !dest) return
    const version = ++previewVersionRef.current

    setPreviews({
      foot:   { loading: true },
      bicing: { loading: true },
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

    setPreviews(prev => {
      const next = { ...prev }
      for (const r of results) {
        if (r.error || r.data?.error) {
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
    computePreviews(originPoint, destPoint)
  }, [phase, originPoint, destPoint, computePreviews])

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
    // Vuela al destino
    flyTo({ lat: point.lat, lng: point.lng, zoom: 15 })
    // Pasa a fase opciones
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
    setMode(modeId)
    setOrigin(originPoint)
    setDestination(destPoint)

    // Reuse preview data to avoid a redundant OSRM call (the public server rate-limits).
    const previewData = previews[modeId]?.data
    if (previewData) {
      setRoute(previewData)
      return
    }

    // Preview not yet ready (still loading or errored): fetch directly.
    setLoading(true)
    try {
      const result = await fetchRoute(originPoint.lat, originPoint.lng, destPoint.lat, destPoint.lng, modeId)
      if (result.error) setError(result.error)
      else setRoute(result)
    } catch {
      setError('No se pudo calcular la ruta. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  /* ────────────────── Pill collapsada ────────────────── */

  const activeModeMeta = MODE_BY_ID[mode] ?? MODE_BY_ID.foot
  const showActiveInPill = phase === 'pill' && route?.segments?.length > 0

  /* ────────────────── Render ────────────────── */

  return (
    <>
      {/* ─── Pill ─── */}
      <AnimatePresence>
        {phase === 'pill' && (
          <motion.button
            key="pill"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            onClick={enterSearch}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-40
              flex items-center gap-2.5 px-5 py-2.5
              panel-glass rounded-full transition-all
              text-white/70 hover:text-white"
            style={showActiveInPill ? {
              borderColor: activeModeMeta.color + '55',
              boxShadow: `0 0 18px ${activeModeMeta.color}22`,
            } : undefined}
          >
            {showActiveInPill ? (
              <>
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: activeModeMeta.color, boxShadow: `0 0 8px ${activeModeMeta.color}` }}
                />
                <span className="text-xs font-mono tracking-wide truncate max-w-[220px]" style={{ color: activeModeMeta.color }}>
                  {destPoint?.label ?? destination?.label ?? 'Destino'}
                </span>
                <span className="text-white/30 text-[10px] font-mono">·</span>
                <span className="text-xs font-mono" style={{ color: activeModeMeta.color }}>
                  {fmtTime(route.duration)}
                </span>
              </>
            ) : (
              <>
                <span className="text-white/60"><Icon.search /></span>
                <span className="text-xs font-mono tracking-wide">¿A dónde quieres ir?</span>
              </>
            )}
          </motion.button>
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
            className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-[420px] max-w-[92vw]"
          >
            <div className="panel-glass rounded-2xl p-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={exitToPill}
                  title="Cerrar"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors flex-shrink-0"
                >
                  <Icon.close />
                </button>
                <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.07] focus-within:border-cyan-400/40 transition-colors">
                  <span className="text-white/50"><Icon.search /></span>
                  <input
                    ref={destInputRef}
                    className="flex-1 bg-transparent text-sm font-mono text-white/90 placeholder-white/30 outline-none min-w-0"
                    placeholder="¿A dónde quieres ir?"
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
                <div className="mt-3 px-3 py-2 text-[11px] text-white/30 font-mono">
                  Empieza a escribir para buscar una dirección, restaurante o lugar en Barcelona.
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
            className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-[440px] max-w-[94vw]"
          >
            <div className="panel-glass rounded-2xl overflow-hidden">

              {/* Header: destino */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06]">
                <button
                  onClick={() => setPhase('search')}
                  title="Volver a la búsqueda"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors flex-shrink-0"
                >
                  <Icon.back />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-white/35">Destino</p>
                  <p className="text-xs font-mono text-white/90 truncate">{destPoint?.label ?? '—'}</p>
                </div>
                <button
                  onClick={exitToPill}
                  title="Cerrar"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors flex-shrink-0"
                >
                  <Icon.close />
                </button>
              </div>

              {/* Inputs origen / destino editables + swap */}
              <div className="px-3 pt-3 pb-2 flex flex-col gap-2">
                <PointField
                  value={originQuery}
                  onChange={(v) => {
                    setOriginQuery(v)
                    if (!v) setOriginPoint(null)
                  }}
                  onPickSuggestion={handlePickOriginSuggestion}
                  onMyLocation={handleMyLocationOrigin}
                  placeholder="Origen"
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
                  placeholder="Destino"
                  dot="#ff6b35"
                />
              </div>

              {/* Tarjetas de modo */}
              <div className="px-3 pb-3 pt-1 flex flex-col gap-1.5">
                {MODES.map(m => (
                  <ModeCard
                    key={m.id}
                    mode={m}
                    state={previews[m.id]}
                    isActive={mode === m.id && route?.segments?.length > 0}
                    onClick={() => handleActivateMode(m.id)}
                    metroLines={metroLines}
                  />
                ))}
              </div>

              {/* Panel detallado paso a paso */}
              <AnimatePresence>
                {route?.segments?.length > 0 && (
                  <motion.div
                    key="route-step-panel"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <RouteStepPanel
                      segments={route.segments}
                      origin={originPoint}
                      destination={destPoint}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Estado de ruta activa */}
              {isLoading && (
                <div className="px-3 pb-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04]">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: activeModeMeta.color, animationDelay: `${d}ms` }} />
                    ))}
                    <span className="text-[11px] text-white/40 font-mono ml-1">Activando ruta...</span>
                  </div>
                </div>
              )}
              {route?.segments?.length > 0 && !isLoading && (
                <div className="px-3 pb-3">
                  <button
                    onClick={() => { setPhase('pill') }}
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors"
                    style={{
                      color: activeModeMeta.color,
                      background: activeModeMeta.color + '14',
                      border: `1px solid ${activeModeMeta.color}40`,
                    }}
                  >
                    Ver en el mapa
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
