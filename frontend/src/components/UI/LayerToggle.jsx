import React from 'react'
import { motion } from 'framer-motion'
import { useMapStore } from '../../store/mapStore'

const THEMES = [
  { id: 'voyager', icon: '◐', title: 'Estàndard' },
  { id: 'dark',    icon: '◉', title: 'Nit'        },
  { id: 'minimal', icon: '○', title: 'Minimal'    },
]

const TRAFFIC_MODES = [
  { id: 'flux',      label: 'Flux'       },
  { id: 'heatmap',   label: 'Heatmap'    },
  { id: 'incidents', label: 'Incidències'},
]

const DATA_LAYERS = [
  { id: 'traffic', label: 'Trànsit', color: '#27AE60' },
  { id: 'bicing',  label: 'Bicing',  color: '#00aaff' },
  { id: 'bus',     label: 'Bus',     color: '#FF6B35' },
  { id: 'metro',   label: 'Metro',   color: '#A855F7' },
]

export default function LayerToggle() {
  const { mapTheme, setMapTheme, activeLayers, toggleLayer, trafficMode, setTrafficMode } = useMapStore()

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 4, duration: 0.4 }}
      className="absolute bottom-8 left-4 flex flex-col gap-2"
    >
      {/* Selector de tema */}
      <div className="panel-glass rounded-lg p-2 flex gap-1">
        {THEMES.map(t => (
          <button
            key={t.id}
            onClick={() => setMapTheme(t.id)}
            title={t.title}
            className={`w-7 h-7 rounded text-sm transition-all flex items-center justify-center
              ${mapTheme === t.id
                ? 'bg-white/20 text-white'
                : 'text-white/35 hover:text-white/70'}`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {/* Modo de tráfico (solo si transit activo) */}
      {activeLayers.includes('traffic') && (
        <div className="panel-glass rounded-lg p-1.5 flex gap-1">
          {TRAFFIC_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setTrafficMode(m.id)}
              className={`px-2 py-1 rounded text-xs transition-all
                ${trafficMode === m.id
                  ? 'bg-white/15 text-white'
                  : 'text-white/35 hover:text-white/60'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Toggles de capa */}
      {DATA_LAYERS.map(layer => {
        const isActive = activeLayers.includes(layer.id)
        return (
          <button
            key={layer.id}
            onClick={() => toggleLayer(layer.id)}
            className="panel-glass rounded-lg px-3 py-2 flex items-center gap-2 text-sm transition-all"
            style={{ borderColor: isActive ? layer.color + '40' : 'transparent' }}
          >
            <span
              className="w-3 h-3 rounded-full transition-opacity"
              style={{
                backgroundColor: layer.color,
                opacity: isActive ? 1 : 0.25,
                boxShadow: isActive ? `0 0 6px ${layer.color}` : 'none',
              }}
            />
            <span className={isActive ? 'text-white' : 'text-white/30'}>
              {layer.label}
            </span>
          </button>
        )
      })}
    </motion.div>
  )
}
