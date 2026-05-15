import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNearbyStore, NEARBY_CATEGORIES } from '../../store/nearbyStore'
import { useMapStore } from '../../store/mapStore'
import { useRouteStore } from '../../store/routeStore'
import { useNearbyPois } from '../../hooks/useNearbyPois'

function formatDistance(m) {
  if (m == null) return ''
  if (m < 1000) return `${m}m`
  return `${(m / 1000).toFixed(1)}km`
}

function ToggleButton() {
  const { isOpen, togglePanel } = useNearbyStore()
  return (
    <button
      onClick={togglePanel}
      title="Buscar cerca"
      className={`absolute bottom-6 left-6 z-40 flex items-center gap-2 px-3.5 py-2.5
        rounded-2xl panel-glass border transition-all duration-200
        ${isOpen
          ? 'border-cyan-400/50 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.15)]'
          : 'border-white/[0.08] text-white/60 hover:text-cyan-300 hover:border-cyan-400/30'}`}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
        <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className="text-xs font-mono tracking-wide">{isOpen ? 'Cerca' : 'Qué hay cerca'}</span>
    </button>
  )
}

export default function NearbyPanel() {
  useNearbyPois()
  const { isOpen, closePanel, activeCategory, setCategory, pois, isLoading, selectPoi, selectedPoi, clearSelected } = useNearbyStore()
  const flyTo = useMapStore(s => s.flyTo)

  const handlePoiClick = (poi) => {
    selectPoi(poi)
    flyTo({ lat: poi.lat, lng: poi.lng, zoom: 16 })
  }

  const handleRoute = (poi) => {
    const { setDestination, setOrigin, setMode, setChatRequest } = useRouteStore.getState()
    const userLocation = useMapStore.getState().userLocation
    const origin = userLocation ? { ...userLocation, label: 'Mi ubicación' } : null
    const destination = { lat: poi.lat, lng: poi.lng, label: poi.name }
    setMode('foot')
    if (origin) setOrigin(origin)
    setDestination(destination)
    setChatRequest({ origin, destination, mode: 'foot', route: null })
  }

  return (
    <>
      <ToggleButton />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="nearby-panel"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
            className="absolute bottom-[78px] left-6 z-40 w-[320px] max-h-[60vh] flex flex-col
              rounded-2xl overflow-hidden
              bg-black/92 backdrop-blur-2xl border border-white/[0.08]
              shadow-[0_0_50px_rgba(0,0,0,0.7),0_0_24px_rgba(34,211,238,0.06)]"
          >
            <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-cyan-300/80 text-[10px] font-mono tracking-[0.15em] uppercase">
                  Qué hay cerca
                </span>
              </div>
              <button
                onClick={closePanel}
                className="text-white/25 hover:text-white/70 transition-colors w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/[0.05] text-base leading-none"
              >×</button>
            </div>

            <div className="px-3 py-2.5 flex flex-wrap gap-1.5 border-b border-white/[0.04] flex-shrink-0">
              {NEARBY_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-all flex items-center gap-1.5
                    ${activeCategory === cat.id
                      ? 'bg-cyan-500/15 border border-cyan-400/40 text-cyan-200'
                      : 'bg-white/[0.03] border border-white/[0.05] text-white/55 hover:text-white/85 hover:border-white/[0.12]'
                    }`}
                >
                  <span className="text-sm">{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {!activeCategory && (
                <div className="flex flex-col items-center justify-center py-10 px-4">
                  <p className="text-white/30 text-xs text-center leading-relaxed">
                    Elige una categoría para descubrir lugares cerca de ti
                  </p>
                </div>
              )}

              {activeCategory && isLoading && (
                <div className="flex items-center justify-center py-10 gap-1.5">
                  {[0, 120, 240].map(d => (
                    <span key={d} className="w-1 h-1 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              )}

              {activeCategory && !isLoading && pois.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 px-4 gap-1.5">
                  <span className="text-white/20 text-2xl">∅</span>
                  <p className="text-white/30 text-xs text-center">Nada encontrado cerca</p>
                </div>
              )}

              {activeCategory && !isLoading && pois.length > 0 && (
                <ul className="divide-y divide-white/[0.04]">
                  {pois.map(poi => {
                    const active = selectedPoi?.id === poi.id
                    return (
                      <li
                        key={poi.id}
                        onClick={() => handlePoiClick(poi)}
                        className={`px-4 py-2.5 cursor-pointer transition-colors
                          ${active ? 'bg-cyan-500/[0.06]' : 'hover:bg-white/[0.03]'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-white/90 text-[13px] font-medium truncate leading-tight">{poi.name}</p>
                            {poi.address && (
                              <p className="text-white/35 text-[11px] truncate mt-0.5">{poi.address}</p>
                            )}
                            {poi.cuisine && (
                              <p className="text-cyan-400/60 text-[10px] font-mono mt-0.5 capitalize">{poi.cuisine.replace(/_/g, ' ')}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {poi.distance_m != null && (
                              <span className="text-white/40 text-[10px] font-mono">{formatDistance(poi.distance_m)}</span>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRoute(poi) }}
                              className="text-cyan-400/70 hover:text-cyan-300 text-[10px] font-mono"
                            >→</button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {selectedPoi && (
              <div className="border-t border-white/[0.05] px-4 py-2.5 bg-white/[0.02] flex-shrink-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-white/80 text-[12px] font-medium truncate">{selectedPoi.name}</p>
                  <button onClick={clearSelected} className="text-white/30 hover:text-white/70 text-sm leading-none">×</button>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-white/45">
                  {selectedPoi.phone && (
                    <a href={`tel:${selectedPoi.phone}`} className="px-2 py-0.5 rounded bg-white/[0.04] hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors">
                      {selectedPoi.phone}
                    </a>
                  )}
                  {selectedPoi.website && (
                    <a href={selectedPoi.website} target="_blank" rel="noreferrer" className="px-2 py-0.5 rounded bg-white/[0.04] hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors">
                      web ↗
                    </a>
                  )}
                  {selectedPoi.opening_hours && (
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] truncate max-w-[150px]" title={selectedPoi.opening_hours}>
                      {selectedPoi.opening_hours}
                    </span>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
