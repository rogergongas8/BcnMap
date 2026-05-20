import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouteStore } from '../../store/routeStore'
import { useMapStore } from '../../store/mapStore'
import { useDataStore } from '../../store/dataStore'
import { useDrawerStore } from '../../store/drawerStore'
import { useChatStore } from '../../store/chatStore'
import { useRoute } from '../../hooks/useRoute'
import { fetchRoute, fetchMetroArrivals, addSavedRoute } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
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

  const trafficNote  = mode.id === 'car' ? (data?.traffic?.note ?? data?.segments?.[0]?.meta?.traffic_note) : null
  const congestion   = mode.id === 'car' ? (data?.traffic?.congestion ?? data?.segments?.[0]?.meta?.congestion) : null
  const trafficColor = congestion >= 80 ? '#ff3333' : congestion >= 60 ? '#ffcc00' : '#00ff88'
  const inefficient  = data?.inefficient === true
  const inefficientReason = data?.inefficient_reason

  const accentColor = isActive && !inefficient ? color : inefficient ? '#333' : '#262626'

  return (
    <motion.button
      layout
      onClick={onClick}
      whileTap={{ scale: 0.99 }}
      className="w-full text-left overflow-hidden flex transition-all"
      style={{
        borderRadius: 6,
        border: `1px solid ${isActive && !inefficient ? color + '55' : '#262626'}`,
        background: isActive && !inefficient ? '#1C1C1C' : inefficient ? '#111' : '#1A1A1A',
        opacity: inefficient ? 0.55 : 1,
      }}
    >
      {/* 3px accent bar */}
      <div className="w-[3px] flex-shrink-0 self-stretch transition-colors" style={{ background: accentColor, borderRadius: '2px 0 0 2px' }} />

      <div className="flex items-center gap-3 px-3 py-2.5 flex-1 min-w-0">
        <span
          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
          style={{
            color:      inefficient ? '#444' : color,
            background: '#262626',
          }}
        >
          <ModeIcon size={18} />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em]"
                  style={{ color: inefficient ? '#444' : isActive ? color : '#888' }}>
              {mode.label}
            </span>

            <div className="flex items-center gap-2">
              {mode.isRecommended && (
                <span className="font-mono text-[8px] uppercase tracking-[0.08em] px-1.5 py-0.5"
                  style={{ background: '#E8622A', color: '#fff', borderRadius: 3 }}>
                  IA
                </span>
              )}
              {data && !inefficient && (
                <span className="font-syne text-[13px] font-semibold" style={{ color: isActive ? color : '#EBEBEB' }}>
                  {fmtTime(data.duration)}
                </span>
              )}
              {data && inefficient && (
                <span className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: '#C98E2E' }}>
                  ⚠ No eficient
                </span>
              )}
              {loading && (
                <span className="flex items-center gap-1">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-1 h-1 rounded-full animate-bounce" style={{ background: color, animationDelay: `${d}ms` }} />
                  ))}
                </span>
              )}
              {failed && <span className="font-mono text-[9px]" style={{ color: '#555' }}>No disponible</span>}
            </div>
          </div>

          {data && segs.length > 0 && !inefficient && (
            <div className="mt-1.5">
              <SegmentSequence segments={segs} metroLines={metroLines} />
            </div>
          )}
          {data && inefficient && inefficientReason && (
            <p className="mt-0.5 font-mono text-[10px]" style={{ color: '#555' }}>{inefficientReason}</p>
          )}
          {data && !inefficient && (
            <div className="mt-1 flex items-center gap-2 font-mono text-[10px]" style={{ color: '#555' }}>
              {data.distance != null && <span>{fmtDist(data.distance)}</span>}
              {trafficNote && (
                <span className="font-mono text-[9px] px-1.5 py-0.5" style={{ color: trafficColor, background: trafficColor + '18', borderRadius: 3 }}>
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

function StepNodeMetro({ name, lineNames, lineColors, stationId, direction }) {
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
        {direction && (
          <p className="text-[10px] font-mono truncate" style={{ color: bg + 'cc' }}>
            dir. {direction}
          </p>
        )}
        {stationId && (
          <p className="mt-0.5">
            <MetroArrivalsLine stationId={stationId} lines={lineNames} />
          </p>
        )}
      </div>
    </div>
  )
}

function StepNodeTransfer({ name, fromLine, fromColor, toLine, toColor, toDirection, stationId }) {
  const toClr = toColor ?? '#888'
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
            style={{ background: toClr, boxShadow: `0 0 4px ${toClr}88` }}
          >
            {toLine ?? 'M'}
          </span>
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-mono text-white/80 truncate">{name}</p>
        <p className="text-[10px] font-mono text-white/35">Transbordo
          {toDirection && (
            <span style={{ color: toClr + 'cc' }}> · dir. {toDirection}</span>
          )}
        </p>
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

function RouteStepPanel({ segments, origin, destination, mode }) {
  const { isNavigating, startNavigation, stopNavigation } = useRouteStore()
  const canNavigate = (mode === 'foot' || mode === 'bike') && segments?.[0]?.steps?.length > 0

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
          direction: m.direction ?? null,
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
          toDirection: next.meta?.direction ?? null,
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
          direction: null,
        })
      }
    }
  }

  // Nodo de destino al final
  nodes.push({ kind: 'dest', label: destination?.label })

  return (
    <div className="mx-3 mb-3 mt-1 rounded-xl bg-white/[0.02] border border-white/[0.05] p-3 max-h-[280px] overflow-y-auto">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[9px] font-mono uppercase tracking-wider text-white/35">Paso a paso</p>
        {canNavigate && (
          <button
            onClick={isNavigating ? stopNavigation : startNavigation}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all
              ${isNavigating
                ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
                : 'bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/20'}`}
          >
            {isNavigating ? '⏹ Parar' : '▶ Navegar'}
          </button>
        )}
      </div>
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
              direction={node.direction}
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
              toDirection={node.toDirection}
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
        background: saved ? '#E8622A1A' : '#1C1C1C',
        border: `1px solid ${saved ? '#E8622A' : '#262626'}`,
        color: saved ? '#E8622A' : '#555',
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
  const planHydratedRef   = useRef(false) // true when previews come from a plan_trip (skip refetch)

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
    // Skip if previews were just loaded from a plan_trip response
    if (planHydratedRef.current) { planHydratedRef.current = false; return }
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

  /* ────────────────── Posición horizontal dinámica ────────────────── */
  // Shift SearchBar center to avoid overlapping SideDrawer (left) or ChatPanel (right)
  const drawerView = useDrawerStore(s => s.view)
  const chatOpen   = useChatStore(s => s.isOpen)
  // SideDrawer: left-[68px] + 340px wide = 408px. Shift right by half: +204px
  // ChatPanel:  340px from right edge. Shift left by half: -170px
  const hShift = (drawerView ? 204 : 0) - (chatOpen ? 170 : 0)
  const centeredLeft = hShift === 0 ? '50%' : `calc(50% + ${hShift}px)`

  /* ────────────────── Render embegut (TopBar) ────────────────── */

  if (embedded) {
    // Shared share icon helper
    const ShareIcon = () => shareToast
      ? <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      : <><circle cx="12.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="12.5" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="3.5" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/><line x1="5.4" y1="7" x2="10.6" y2="4.4" stroke="currentColor" strokeWidth="1.3"/><line x1="5.4" y1="9" x2="10.6" y2="11.6" stroke="currentColor" strokeWidth="1.3"/></>

    // Absolute dropdown anchored 56px below the TopBar's top edge
    const dropdownStyle = {
      position: 'absolute',
      top: 56,
      left: centeredLeft,
      transform: 'translateX(-50%)',
      zIndex: 60,
    }

    // Reusable options dropdown content
    const OptionsContent = () => (
      <div className="overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.7)]"
        style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8 }}
      >
        {/* Origin / dest fields */}
        <div className="px-3 pt-3 pb-2 flex flex-col gap-2" style={{ borderBottom: '1px solid #1A1A1A' }}>
          <PointField value={originQuery} onChange={v => { setOriginQuery(v); if (!v) setOriginPoint(null) }}
            onPickSuggestion={handlePickOriginSuggestion} onMyLocation={handleMyLocationOrigin}
            placeholder="Origen" dot="#00b4ff"
          />
          <div className="flex items-center gap-2 px-1">
            <div className="flex-1 h-px" style={{ background: '#262626' }} />
            <button onClick={handleSwap} title="Intercanviar" className="transition-colors" style={{ color: '#555' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#EBEBEB' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
            ><Icon.swap size={14} /></button>
            <div className="flex-1 h-px" style={{ background: '#262626' }} />
          </div>
          <PointField value={destQuery} onChange={v => { setDestQuery(v); if (!v) setDestPoint(null) }}
            onPickSuggestion={handlePickDestSuggestionInOptions}
            placeholder="Destí" dot="#ff6b35"
          />
        </div>
        {/* Mode cards */}
        <div className="px-3 py-3 flex flex-col gap-1.5">
          {MODES.map(m => (
            <ModeCard key={m.id}
              mode={{ ...m, isRecommended: iaPlanRecommended === m.id }}
              state={previews[m.id]}
              isActive={mode === m.id && route?.segments?.length > 0}
              onClick={() => handleActivateMode(m.id)}
              metroLines={metroLines}
            />
          ))}
        </div>
        {/* Step panel */}
        <AnimatePresence>
          {route?.segments?.length > 0 && (
            <motion.div key="steps" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <RouteStepPanel segments={route.segments} origin={originPoint} destination={destPoint} mode={mode} />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Loading */}
        {isLoading && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 px-3 py-2" style={{ borderRadius: 6, background: '#1C1C1C' }}>
              {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#E8622A', animationDelay: `${d}ms` }} />)}
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] ml-1" style={{ color: '#555' }}>Calculant ruta…</span>
            </div>
          </div>
        )}
        {/* CTA */}
        {route?.segments?.length > 0 && !isLoading && (
          <div className="px-3 pb-3 flex gap-2">
            <button onClick={() => setPhase('pill')}
              className="flex-1 px-3 py-2.5 font-syne text-[12px] font-semibold"
              style={{ borderRadius: 6, color: '#fff', background: '#E8622A', border: '1px solid #E8622A' }}
            >Veure al mapa →</button>
            <SaveRouteButton originPoint={originPoint} destPoint={destPoint} mode={mode} />
          </div>
        )}
      </div>
    )

    return (
      <>
        {/* ── PILL inline ── */}
        {phase === 'pill' && (
          <div className="w-full flex items-center gap-1.5">
            <button
              onClick={showActiveInPill ? () => setPhase('options') : enterSearch}
              className="flex-1 h-10 flex items-center gap-2.5 px-3 rounded-lg transition-all min-w-0"
              style={{
                background: showActiveInPill ? '#1C1C1C' : 'transparent',
                border: `1px solid ${showActiveInPill ? activeModeMeta.color + '44' : '#262626'}`,
              }}
            >
              {showActiveInPill ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: activeModeMeta.color }} />
                  <span className="font-syne text-[12px] font-medium truncate flex-1 text-left" style={{ color: '#EBEBEB' }}>
                    {destPoint?.label ?? destination?.label ?? 'Destí'}
                  </span>
                  <span className="font-syne text-[12px] font-semibold flex-shrink-0" style={{ color: activeModeMeta.color }}>
                    {fmtTime(route.duration)}
                  </span>
                </>
              ) : (
                <>
                  <Icon.search size={12} style={{ color: '#555', flexShrink: 0 }} />
                  <span className="font-syne text-[12px]" style={{ color: '#555' }}>On vols anar?</span>
                </>
              )}
            </button>
            {showActiveInPill && (
              <button onClick={shareRoute} title="Copiar enllaç"
                className="w-9 h-9 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
                style={{ background: shareToast ? '#E8622A1A' : '#1C1C1C', border: `1px solid ${shareToast ? '#E8622A' : '#262626'}`, color: shareToast ? '#E8622A' : '#555' }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><ShareIcon /></svg>
              </button>
            )}
          </div>
        )}

        {/* ── SEARCH inline ── */}
        {phase === 'search' && (
          <>
            <div className="w-full flex items-center gap-2 h-10">
              <button onClick={exitToPill} className="w-7 h-7 flex items-center justify-center flex-shrink-0 transition-colors" style={{ color: '#555' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#EBEBEB' }} onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
              ><Icon.back size={13} /></button>
              <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg min-w-0"
                style={{ background: '#1C1C1C', border: '1px solid #3a3a3a' }}
              >
                <Icon.search size={12} style={{ color: '#555', flexShrink: 0 }} />
                <input
                  ref={destInputRef}
                  className="flex-1 bg-transparent outline-none font-mono text-[13px] min-w-0"
                  style={{ color: '#EBEBEB' }}
                  placeholder="On vols anar?"
                  value={destQuery}
                  onChange={e => setDestQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') exitToPill()
                    if (e.key === 'Enter' && destSugg[0]) handlePickDestination(destSugg[0])
                  }}
                />
                {destQuery && (
                  <button onMouseDown={e => { e.preventDefault(); setDestQuery('') }} style={{ color: '#555', flexShrink: 0 }}>
                    <Icon.close size={11} />
                  </button>
                )}
              </div>
            </div>
            {/* Suggestions dropdown */}
            {(destLoading || destSugg.length > 0) && (
              <div style={{ ...dropdownStyle, width: 420, maxWidth: '92vw' }}>
                <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
                  <SuggestionList items={destSugg} loading={destLoading} query={destQuery} onPick={handlePickDestination} />
                </div>
              </div>
            )}
          </>
        )}

        {/* ── OPTIONS inline header ── */}
        {phase === 'options' && (
          <>
            <div className="w-full flex items-center gap-2 h-10">
              <button onClick={() => setPhase('search')} className="w-7 h-7 flex items-center justify-center flex-shrink-0 transition-colors" style={{ color: '#555' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#EBEBEB' }} onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
              ><Icon.back size={13} /></button>
              <div className="flex-1 min-w-0">
                <p className="font-syne text-[12px] font-medium truncate" style={{ color: '#EBEBEB' }}>{destPoint?.label ?? '—'}</p>
                {showActiveInPill && (
                  <p className="font-mono text-[9px] leading-none mt-0.5" style={{ color: activeModeMeta.color }}>
                    {activeModeMeta.label} · {fmtTime(route.duration)}
                  </p>
                )}
              </div>
              <button onClick={shareRoute} title="Copiar enllaç"
                className="w-7 h-7 flex items-center justify-center flex-shrink-0 transition-colors rounded"
                style={{ color: shareToast ? '#E8622A' : '#555' }}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><ShareIcon /></svg>
              </button>
              <button onClick={exitToPill} className="w-7 h-7 flex items-center justify-center flex-shrink-0 transition-colors" style={{ color: '#555' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#EBEBEB' }} onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
              ><Icon.close size={11} /></button>
            </div>
            {/* Options dropdown */}
            <div style={{ ...dropdownStyle, width: 440, maxWidth: '94vw' }}>
              <OptionsContent />
            </div>
          </>
        )}
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
                background: '#141414',
                border: `1px solid ${showActiveInPill ? activeModeMeta.color + '66' : '#262626'}`,
                borderRadius: 8,
                boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
              }}
            >
              {showActiveInPill ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: activeModeMeta.color }} />
                  <span className="font-syne text-[12px] font-medium truncate max-w-[180px]" style={{ color: '#EBEBEB' }}>
                    {destPoint?.label ?? destination?.label ?? 'Destí'}
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: '#333' }}>·</span>
                  <span className="font-syne text-[13px] font-semibold" style={{ color: activeModeMeta.color }}>
                    {fmtTime(route.duration)}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ color: '#555' }}><Icon.search /></span>
                  <span className="font-syne text-[12px]" style={{ color: '#888' }}>On vols anar?</span>
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
                  background: shareToast ? '#E8622A1A' : '#141414',
                  border: `1px solid ${shareToast ? '#E8622A' : '#262626'}`,
                  borderRadius: 8,
                  color: shareToast ? '#E8622A' : '#555',
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
            <div className="p-3" style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
              <div className="flex items-center gap-2">
                <button
                  onClick={exitToPill}
                  title="Cerrar"
                  className="w-8 h-8 flex items-center justify-center transition-colors flex-shrink-0"
                  style={{ borderRadius: 6, background: '#1C1C1C', border: '1px solid #262626', color: '#555' }}
                >
                  <Icon.close />
                </button>
                <div className="flex items-center gap-2 flex-1 px-3 py-2 transition-colors"
                  style={{ borderRadius: 6, background: '#1C1C1C', border: '1px solid #262626' }}
                >
                  <span style={{ color: '#555' }}><Icon.search /></span>
                  <input
                    ref={destInputRef}
                    className="flex-1 bg-transparent outline-none min-w-0 font-mono text-[13px]"
                    style={{ color: '#EBEBEB' }}
                    placeholder="On vols anar?"
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
                <div className="mt-3 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: '#555' }}>
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
            <div className="overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
              style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8 }}
            >
              {/* Header: destino */}
              <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid #262626' }}>
                <button
                  onClick={() => setPhase('search')}
                  title="Volver a la búsqueda"
                  className="w-7 h-7 flex items-center justify-center transition-colors flex-shrink-0"
                  style={{ borderRadius: 6, color: '#555' }}
                >
                  <Icon.back />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[8px] uppercase tracking-[0.14em]" style={{ color: '#555' }}>Destí</p>
                  <p className="font-syne text-[13px] font-medium truncate" style={{ color: '#EBEBEB' }}>{destPoint?.label ?? '—'}</p>
                </div>
                <button
                  onClick={exitToPill}
                  title="Cerrar"
                  className="w-7 h-7 flex items-center justify-center transition-colors flex-shrink-0"
                  style={{ borderRadius: 6, color: '#555' }}
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
                    mode={{ ...m, isRecommended: iaPlanRecommended === m.id }}
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
                      mode={mode}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Estado de ruta activa */}
              {isLoading && (
                <div className="px-3 pb-3">
                  <div className="flex items-center gap-2 px-3 py-2" style={{ borderRadius: 6, background: '#1C1C1C' }}>
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#E8622A', animationDelay: `${d}ms` }} />
                    ))}
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] ml-1" style={{ color: '#555' }}>Calculant ruta…</span>
                  </div>
                </div>
              )}
              {route?.segments?.length > 0 && !isLoading && (
                <div className="px-3 pb-3 flex gap-2">
                  <button
                    onClick={() => { setPhase('pill') }}
                    className="flex-1 px-3 py-2.5 font-syne text-[12px] font-semibold transition-colors"
                    style={{
                      borderRadius: 6,
                      color: '#fff',
                      background: '#E8622A',
                      border: '1px solid #E8622A',
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
