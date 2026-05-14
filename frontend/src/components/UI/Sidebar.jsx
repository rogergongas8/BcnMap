import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useMapStore } from '../../store/mapStore'

const THEMES = [
  { id: 'voyager', icon: '◐', title: 'Estàndard' },
  { id: 'dark',    icon: '◉', title: 'Nit'        },
  { id: 'minimal', icon: '○', title: 'Minimal'    },
]

const TRAFFIC_MODES = [
  { id: 'flux',      label: 'Flux'        },
  { id: 'heatmap',   label: 'Heatmap'     },
  { id: 'incidents', label: 'Incidències' },
]

const BCN_HOME = { lat: 41.3851, lng: 2.1734, zoom: 13 }

export default function Sidebar({ activeLayers, onToggleLayer, trafficMode, onTrafficMode }) {
  const [isOpen, setIsOpen] = useState(false)
  const { mapTheme, setMapTheme, pitch, showBuildings3D, togglePitch, toggleBuildings, flyTo } = useMapStore()
  const is3D = pitch > 10

  const layers = [
    { id: 'traffic',    label: 'Trànsit',        color: '#27AE60' },
    { id: 'bicing',     label: 'Bicing',          color: '#00aaff' },
    { id: 'airquality', label: 'Qualitat Aire',   color: '#ff6600' },
  ]

  return (
    <motion.div
      animate={{ width: isOpen ? 272 : 40 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute left-0 top-0 h-full z-40 flex overflow-hidden
        bg-black/90 backdrop-blur-md border-r border-white/10"
    >
      {/* Tab de apertura (siempre visible) */}
      <div className="w-10 flex-shrink-0 flex flex-col items-center justify-center py-4">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex flex-col items-center gap-2 text-white/30 hover:text-white/70 transition-colors"
          title={isOpen ? 'Tancar' : 'Obrir panell'}
        >
          <span className="text-lg">{isOpen ? '‹' : '›'}</span>
          <span
            className="text-[9px] font-mono tracking-widest uppercase"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Capas
          </span>
        </button>
      </div>

      {/* Contenido expandido */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">

          {/* Tema */}
          <section className="flex flex-col gap-2">
            <span className="text-white/25 text-[9px] font-mono tracking-widest uppercase">Tema</span>
            <div className="flex gap-1">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMapTheme(t.id)}
                  title={t.title}
                  className={`flex-1 h-8 rounded-lg text-sm transition-all
                    ${mapTheme === t.id ? 'bg-white/15 text-white' : 'text-white/30 hover:text-white/60'}`}
                >
                  {t.icon}
                </button>
              ))}
            </div>
          </section>

          {/* Capas */}
          <section className="flex flex-col gap-2">
            <span className="text-white/25 text-[9px] font-mono tracking-widest uppercase">Capas</span>
            <div className="flex flex-col gap-1">
              {layers.map((layer) => {
                const active = activeLayers.includes(layer.id)
                return (
                  <div key={layer.id} className="flex flex-col">
                    <button
                      onClick={() => onToggleLayer(layer.id)}
                      className="flex items-center justify-between py-2 px-2 rounded-lg
                        hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0 transition-opacity"
                          style={{ backgroundColor: layer.color, opacity: active ? 1 : 0.25,
                            boxShadow: active ? `0 0 6px ${layer.color}` : 'none' }}
                        />
                        <span className={`text-sm font-mono ${active ? 'text-white' : 'text-white/30'}`}>
                          {layer.label}
                        </span>
                      </div>
                      <div className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0
                        ${active ? 'bg-white/20' : 'bg-white/8'}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all
                          ${active ? 'left-4 bg-white' : 'left-0.5 bg-white/30'}`} />
                      </div>
                    </button>

                    {layer.id === 'traffic' && active && (
                      <div className="flex gap-1 ml-4 mb-1">
                        {TRAFFIC_MODES.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => onTrafficMode(m.id)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors
                              ${trafficMode === m.id ? 'bg-white/15 text-white' : 'text-white/30 hover:text-white/60'}`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Vista */}
          <section className="flex flex-col gap-2">
            <span className="text-white/25 text-[9px] font-mono tracking-widest uppercase">Vista</span>
            <div className="flex gap-1">
              <button
                onClick={togglePitch}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-colors
                  ${is3D ? 'bg-white/15 text-white' : 'text-white/35 hover:text-white/70'}`}
              >
                {is3D ? '2D' : '3D'}
              </button>
              {mapTheme !== 'minimal' && (
                <button
                  onClick={toggleBuildings}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-colors
                    ${showBuildings3D ? 'bg-white/15 text-white' : 'text-white/35 hover:text-white/70'}`}
                >
                  EDI
                </button>
              )}
              <button
                onClick={() => flyTo(BCN_HOME)}
                className="flex-1 py-1.5 rounded-lg text-xs font-mono text-white/35 hover:text-white/70 transition-colors"
              >
                BCN
              </button>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  )
}
