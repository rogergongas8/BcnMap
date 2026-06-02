import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useMapStore } from '../../store/mapStore'
import { useLeisureStore } from '../../store/leisureStore'
import { useDataStore } from '../../store/dataStore'
import { useChatStore } from '../../store/chatStore'
import { Icons } from '../UI/icons'

const BCN_CENTER = { lat: 41.3851, lng: 2.1734, zoom: 13 }

const THEME_IDS  = ['dark', 'voyager', 'minimal']
const LAYER_DEFS = [
  { id: 'traffic', color: '#27AE60' },
  { id: 'bicing',  color: '#00aaff' },
  { id: 'bus',     color: '#FF6B35' },
  { id: 'metro',   color: '#A855F7' },
  { id: 'events',  color: '#C98E2E' },
]

function GeoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="1.8" fill="currentColor"/>
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1"/>
      <line x1="6" y1="0" x2="6" y2="1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <line x1="6" y1="10.5" x2="6" y2="12" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <line x1="0" y1="6" x2="1.5" y2="6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <line x1="10.5" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}

function LayersPanel({ onClose }) {
  const { t } = useTranslation()
  const { mapTheme, setMapTheme, activeLayers, toggleLayer } = useMapStore()
  const { showBeaches, toggleBeaches } = useLeisureStore()
  const disruptions = useDataStore(s => s.disruptions)

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.15, ease: [0.2, 0.7, 0.2, 1] }}
      className="absolute bottom-0 right-full mr-2 z-[60] w-[230px] overflow-hidden"
      style={{ background: '#151210', border: '1px solid #2C2926', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}
    >
      <header className="px-3.5 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid #201E1B' }}>
        <p className="font-syne text-[12px] font-medium" style={{ color: '#F7F6F4' }}>{t('topbar.layersTitle')}</p>
        <button onClick={onClose} style={{ color: '#8C8884' }}>
          <Icons.close size={10} />
        </button>
      </header>

      <section className="px-3 py-2.5" style={{ borderBottom: '1px solid #201E1B' }}>
        <p className="font-mono text-[9px] uppercase tracking-[0.15em] mb-2" style={{ color: '#8C8884' }}>{t('topbar.mapStyle')}</p>
        <div className="grid grid-cols-3 gap-1">
          {THEME_IDS.map(id => (
            <button key={id} onClick={() => setMapTheme(id)}
              className="py-1.5 font-syne text-[10px] font-medium transition-colors"
              style={{
                borderRadius: 6,
                background: mapTheme === id ? '#B8885A' : '#211F1B',
                border: `1px solid ${mapTheme === id ? '#B8885A' : '#2C2926'}`,
                color: mapTheme === id ? '#fff' : '#B0ACA7',
              }}
            >{t(`topbar.themes.${id}`)}</button>
          ))}
        </div>
      </section>

      <section className="px-3 py-2.5" style={{ borderBottom: '1px solid #201E1B' }}>
        <p className="font-mono text-[9px] uppercase tracking-[0.15em] mb-2" style={{ color: '#8C8884' }}>{t('topbar.liveData')}</p>
        <div className="flex flex-col gap-0.5">
          {LAYER_DEFS.map(layer => {
            const on = activeLayers.includes(layer.id)
            return (
              <button key={layer.id} onClick={() => toggleLayer(layer.id)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 w-full transition-colors"
                style={{ borderRadius: 6, background: on ? '#211F1B' : 'transparent' }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: layer.color, opacity: on ? 1 : 0.35 }} />
                <span className="font-syne text-[11px] flex-1 text-left" style={{ color: on ? '#F7F6F4' : '#B0ACA7' }}>{t(`topbar.layers.${layer.id}`)}</span>
                {layer.id === 'metro' && disruptions.length > 0 ? (
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: '#D4555220', color: '#D45555', border: '1px solid #D4555240' }}>
                    {disruptions.length}
                  </span>
                ) : (
                  <span className="font-mono text-[9px]" style={{ color: on ? '#B8885A' : 'transparent' }}>on</span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="px-3 py-2.5">
        <button onClick={toggleBeaches}
          className="flex items-center gap-2.5 px-2.5 py-1.5 w-full transition-colors"
          style={{ borderRadius: 6, background: showBeaches ? '#211F1B' : 'transparent' }}
        >
          <Icons.beach size={12} style={{ color: showBeaches ? '#4D84D4' : '#8C8884', flexShrink: 0 }} />
          <span className="font-syne text-[11px] flex-1 text-left" style={{ color: showBeaches ? '#F7F6F4' : '#B0ACA7' }}>{t('topbar.beaches')}</span>
          <span className="font-mono text-[9px]" style={{ color: showBeaches ? '#B8885A' : 'transparent' }}>on</span>
        </button>
      </section>
    </motion.div>
  )
}

export default function MapControls() {
  const { flyTo, togglePitch, toggleBuildings, pitch, showBuildings3D, mapTheme, mapInstance } = useMapStore()
  const { activeLayers } = useMapStore()
  const { showBeaches }  = useLeisureStore()
  const chatOpen = useChatStore(s => s.isOpen)
  const hasAnimatedIn = useRef(false)
  const containerRef  = useRef(null)

  const [layersOpen, setLayersOpen] = useState(false)

  const is3D             = pitch > 10
  const canToggleBuildings = mapTheme !== 'minimal'
  const hasLayersOn = showBeaches || activeLayers.filter(l => l !== 'events').length > 0

  useEffect(() => {
    if (!layersOpen) return
    const handler = e => {
      if (containerRef.current && !containerRef.current.contains(e.target) && e.target.tagName === 'CANVAS') {
        setLayersOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [layersOpen])

  function geolocate() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapInstance?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 16, duration: 1400 })
      },
      () => {},
      { timeout: 8000 }
    )
  }

  const introDelay = hasAnimatedIn.current ? 0 : 4.1

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: chatOpen ? 0 : 1, x: 0, pointerEvents: chatOpen ? 'none' : 'auto' }}
      transition={chatOpen
        ? { duration: 0.15, ease: 'easeIn' }
        : { delay: hasAnimatedIn.current ? 0.18 : introDelay, duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }
      }
      onAnimationComplete={() => { hasAnimatedIn.current = true }}
      className="absolute right-4 bottom-8 select-none flex flex-col items-end gap-2"
    >
      {/* LayersPanel — absolute, positioned relative to motion.div (bottom-0 right-full) */}
      <AnimatePresence>
        {layersOpen && <LayersPanel onClose={() => setLayersOpen(false)} />}
      </AnimatePresence>

      {/* Layers button */}
      <button
        onClick={() => setLayersOpen(v => !v)}
        title="Capas i Estil"
        className="w-[52px] py-2.5 text-[11px] font-mono transition-colors panel-glass rounded-xl"
        style={{ color: layersOpen || hasLayersOn ? '#B8885A' : 'rgba(255,255,255,0.45)' }}
      >
        {hasLayersOn ? (
          <span className="flex items-center justify-center gap-1">
            <Icons.layers size={13} />
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#B8885A' }} />
          </span>
        ) : (
          <span className="flex items-center justify-center">
            <Icons.layers size={13} />
          </span>
        )}
      </button>

      {/* Map controls panel */}
      <div className="panel-glass rounded-xl flex flex-col gap-0 overflow-hidden w-[52px]">
        <button
          onClick={togglePitch}
          title={is3D ? 'Vista cenital' : 'Vista 3D'}
          className={`w-full py-2.5 text-[11px] font-mono transition-colors
            ${is3D ? 'text-white bg-white/8 hover:bg-white/12' : 'text-white/45 hover:text-white/80'}`}
        >
          {is3D ? '2D' : '3D'}
        </button>

        {canToggleBuildings && (
          <button
            onClick={toggleBuildings}
            title={showBuildings3D ? 'Ocultar edificios' : 'Mostrar edificios 3D'}
            className={`w-full py-2.5 text-[11px] font-mono transition-colors border-t border-white/[0.06]
              ${showBuildings3D ? 'text-white bg-white/8 hover:bg-white/12' : 'text-white/45 hover:text-white/80'}`}
          >
            EDI
          </button>
        )}

        <button
          onClick={() => flyTo(BCN_CENTER)}
          title="Centrar en Barcelona"
          className="w-full py-2.5 text-[11px] font-mono text-white/45 hover:text-white/80 transition-colors border-t border-white/[0.06]"
        >
          BCN
        </button>

        <button
          onClick={geolocate}
          title="Mi ubicación"
          className="w-full py-2.5 flex items-center justify-center text-white/45 hover:text-cyan-400 transition-colors border-t border-white/[0.06]"
        >
          <GeoIcon />
        </button>
      </div>
    </motion.div>
  )
}
