import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouteStore } from '../../store/routeStore'
import { useMapStore } from '../../store/mapStore'
import { useRoute } from '../../hooks/useRoute'
import { geocodeSearch } from '../../utils/geocode'

const MODES = [
  { id: 'foot',   label: 'A pie'   },
  { id: 'bicing', label: 'Bicing'  },
  { id: 'car',    label: 'Coche'   },
  { id: 'bus',    label: 'Metro'   },
]

const CATEGORY_LABELS = {
  restaurant: 'Rest.', shop: 'Tienda', tourism: 'Turismo',
  park: 'Parque', transit: 'Tránsito', place: 'Lugar',
  building: 'Edif.', health: 'Salud', education: 'Edu.',
  street: 'Calle', amenity: 'Serv.',
}

const SEG_ICONS = { walk: '↑', bike: '⬡', drive: '▷', metro: '⬛', bus: '⬛' }

function useDebouncedSuggestions(query, delay = 320) {
  const [results, setResults] = useState([])
  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return }
    const t = setTimeout(() => geocodeSearch(query).then(setResults), delay)
    return () => clearTimeout(t)
  }, [query])
  return [results, setResults]
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

function fmtDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}
function fmtTime(s) {
  const min = Math.round(s / 60)
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}min` : `${min} min`
}

function SegmentSteps({ segments }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {segments.map((seg, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-white/20 text-[9px]">›</span>}
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ color: seg.color, background: seg.color + '18' }}
          >
            {SEG_ICONS[seg.type] ?? '→'} {fmtTime(seg.duration)}
          </span>
        </React.Fragment>
      ))}
    </div>
  )
}

function SuggestionList({ items, onPick }) {
  return (
    <AnimatePresence>
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl overflow-hidden
            bg-black/95 border border-white/[0.08] shadow-xl shadow-black/60"
        >
          {items.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => onPick(s)}
              className="w-full text-left px-3 py-2.5 flex items-center gap-2
                hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-0"
            >
              <span className="text-white/60 text-xs font-mono flex-1 truncate">{s.label}</span>
              {s.category && s.category !== 'address' && (
                <span className="text-[9px] font-mono text-white/25 bg-white/[0.05] px-1.5 py-0.5 rounded flex-shrink-0">
                  {CATEGORY_LABELS[s.category] ?? s.category}
                </span>
              )}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PointInput({ placeholder, value, onChange, onSelect, onMapPick, onMyLocation, isPickingMap }) {
  const [focused, setFocused] = useState(false)
  const [sugg, setSugg]       = useDebouncedSuggestions(focused ? value : '')

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
        ${isPickingMap
          ? 'border-cyan-500/50 bg-cyan-500/[0.07]'
          : 'border-white/[0.07] bg-white/[0.04] hover:border-white/[0.12]'}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors
          ${isPickingMap ? 'bg-cyan-400 animate-pulse' : 'bg-white/20'}`}
        />
        <input
          className="flex-1 bg-transparent text-xs font-mono text-white/80 placeholder-white/25 outline-none min-w-0"
          placeholder={isPickingMap ? 'Haz clic en el mapa...' : placeholder}
          value={value}
          onChange={e => { onChange(e.target.value); setSugg([]) }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => { setFocused(false); setSugg([]) }, 180)}
        />
        {onMyLocation && (
          <button
            onMouseDown={onMyLocation}
            title="Mi ubicación"
            className="text-white/25 hover:text-cyan-400 transition-colors flex-shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="1.8" fill="currentColor"/>
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1"/>
              <line x1="6" y1="0" x2="6" y2="1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="6" y1="10.5" x2="6" y2="12" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="0" y1="6" x2="1.5" y2="6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="10.5" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        <button
          onMouseDown={onMapPick}
          title={isPickingMap ? 'Cancelar selección en mapa' : 'Seleccionar en mapa'}
          className={`text-[10px] font-mono transition-colors flex-shrink-0
            ${isPickingMap ? 'text-cyan-400' : 'text-white/20 hover:text-white/55'}`}
        >
          {isPickingMap ? '✕' : '⊕'}
        </button>
      </div>
      <SuggestionList items={sugg} onPick={(s) => { onSelect(s); setSugg([]) }} />
    </div>
  )
}

export default function SearchBar() {
  useRoute()

  const { mapInstance } = useMapStore()
  const {
    isOpen, togglePanel, closePanel,
    mode, setMode,
    origin, destination, picking, setPicking,
    setOrigin, setDestination,
    route, isLoading, error, clearRoute,
  } = useRouteStore()

  const [originQ, setOriginQ] = useState('')
  const [destQ,   setDestQ]   = useState('')

  useEffect(() => { if (origin?.label)      setOriginQ(origin.label) }, [origin])
  useEffect(() => { if (destination?.label) setDestQ(destination.label)  }, [destination])

  const handleMyLocation = async (field) => {
    try {
      const pt = await getCurrentLocation()
      if (field === 'origin') setOrigin(pt)
      else                    setDestination(pt)
      mapInstance?.flyTo({ center: [pt.lng, pt.lat], zoom: 15, duration: 1000 })
    } catch { /* permission denied */ }
  }

  const swap = () => {
    const [o, d, oq, dq] = [origin, destination, originQ, destQ]
    setOrigin(d);    setDestination(o)
    setOriginQ(dq);  setDestQ(oq)
  }

  return (
    <>
      {/* Pill collapsed */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="pill"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ delay: 1.8, duration: 0.3 }}
            onClick={togglePanel}
            className={`absolute top-4 left-1/2 -translate-x-1/2 z-40
              flex items-center gap-2.5 px-5 py-2.5
              panel-glass rounded-full transition-all
              ${route ? 'border border-cyan-500/30 text-cyan-300/80 hover:text-cyan-200' : 'text-white/35 hover:text-white/65'}`}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
              <line x1="8.5" y1="8.5" x2="12" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            {route?.segments ? (
              <div className="flex items-center gap-2">
                <SegmentSteps segments={route.segments} />
                <span className="text-white/30 text-[10px] font-mono">· {fmtDist(route.distance)}</span>
              </div>
            ) : isLoading ? (
              <span className="text-xs font-mono tracking-wide text-white/40">Calculando...</span>
            ) : (
              <span className="text-xs font-mono tracking-wide">¿A dónde quieres ir?</span>
            )}
            {route && <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="search-panel"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-[380px]
              panel-glass rounded-2xl overflow-visible"
          >
            {/* Mode tabs */}
            <div className="flex items-stretch border-b border-white/[0.06]">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex-1 py-2.5 text-[10px] font-mono tracking-wide transition-colors
                    ${mode === m.id ? 'text-cyan-400 bg-cyan-500/10' : 'text-white/30 hover:text-white/60'}`}
                >
                  {m.label}
                </button>
              ))}
              <button
                onClick={closePanel}
                className="px-3 text-white/20 hover:text-white/60 transition-colors text-lg leading-none border-l border-white/[0.06]"
              >×</button>
            </div>

            {/* Inputs */}
            <div className="flex flex-col gap-2 p-3">
              <PointInput
                placeholder="Origen — dirección, restaurante, lugar..."
                value={originQ}
                onChange={v => { setOriginQ(v); if (!v) setOrigin(null) }}
                onSelect={s => { setOriginQ(s.label); setOrigin(s); setPicking(null) }}
                onMapPick={() => setPicking(picking === 'origin' ? null : 'origin')}
                onMyLocation={() => handleMyLocation('origin')}
                isPickingMap={picking === 'origin'}
              />
              <div className="flex items-center gap-2 px-1">
                <div className="flex-1 h-px bg-white/[0.05]" />
                <button onClick={swap} title="Intercambiar" className="text-white/18 hover:text-white/50 transition-colors text-sm font-mono">⇅</button>
                <div className="flex-1 h-px bg-white/[0.05]" />
              </div>
              <PointInput
                placeholder="Destino — dirección, restaurante, lugar..."
                value={destQ}
                onChange={v => { setDestQ(v); if (!v) setDestination(null) }}
                onSelect={s => { setDestQ(s.label); setDestination(s); setPicking(null) }}
                onMapPick={() => setPicking(picking === 'destination' ? null : 'destination')}
                isPickingMap={picking === 'destination'}
              />
            </div>

            {/* Result / loading / error */}
            <AnimatePresence>
              {(isLoading || route || error) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-3 pb-3 overflow-hidden"
                >
                  {isLoading && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.04]">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                      <span className="text-[11px] text-white/30 font-mono ml-1">Calculando ruta...</span>
                    </div>
                  )}
                  {!isLoading && error && (
                    <p className="text-[11px] text-red-400/70 font-mono px-1">{error}</p>
                  )}
                  {!isLoading && route?.segments && (
                    <div className="rounded-lg bg-cyan-500/[0.06] border border-cyan-500/20 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5 border-b border-cyan-500/[0.12]">
                        <SegmentSteps segments={route.segments} />
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-white/40 text-xs font-mono">{fmtDist(route.distance)}</span>
                          <button
                            onClick={() => { clearRoute(); setOriginQ(''); setDestQ('') }}
                            className="text-white/20 hover:text-white/55 transition-colors text-xs ml-1"
                          >✕</button>
                        </div>
                      </div>
                      <div className="px-3 py-2 flex flex-col gap-1.5">
                        {route.segments.map((seg, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                            <span className="text-[11px] font-mono flex-1 truncate" style={{ color: seg.color + 'cc' }}>
                              {seg.label}{seg.meta?.station_name ? ` · ${seg.meta.station_name}` : ''}{seg.meta?.from_station ? ` · ${seg.meta.from_station}` : ''}
                            </span>
                            <span className="text-white/30 text-[11px] font-mono flex-shrink-0">{fmtTime(seg.duration)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
