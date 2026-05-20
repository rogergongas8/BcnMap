import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icons } from './icons'
import { useDrawerStore } from '../../store/drawerStore'
import { useNearbyStore } from '../../store/nearbyStore'
import { useLeisureStore } from '../../store/leisureStore'
import { useMapStore } from '../../store/mapStore'
import { useAuthStore } from '../../store/authStore'
import { useAuth } from '../../hooks/useAuth'
import LoginModal from './LoginModal'

const THEMES = [
  { id: 'voyager', label: 'Estàndard' },
  { id: 'dark',    label: 'Fosc' },
  { id: 'minimal', label: 'Minimal' },
]

const DATA_LAYERS = [
  { id: 'traffic', label: 'Trànsit', color: '#27AE60' },
  { id: 'bicing',  label: 'Bicing',  color: '#00aaff' },
  { id: 'bus',     label: 'Bus',     color: '#FF6B35' },
  { id: 'metro',   label: 'Metro',   color: '#A855F7' },
]

function ToolButton({ active, onClick, icon: Icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative w-11 h-11 flex items-center justify-center rounded-xl border transition-all
        ${active
          ? 'bg-white text-black border-white shadow-[0_4px_14px_rgba(0,0,0,0.3)]'
          : 'bg-[#0a0c10]/85 backdrop-blur-xl text-white/70 border-white/[0.08] hover:text-white hover:border-white/[0.18]'
        }`}
    >
      <Icon size={16} />
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-sky-400 rounded-full ring-2 ring-[#0a0c10]" />
      )}
    </button>
  )
}

function LayersPopover({ onClose }) {
  const { mapTheme, setMapTheme, activeLayers, toggleLayer } = useMapStore()
  const { showBeaches, toggleBeaches } = useLeisureStore()

  return (
    <motion.div
      initial={{ opacity: 0, x: -8, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -8, scale: 0.96 }}
      transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }}
      className="absolute left-[60px] top-0 w-[230px] rounded-xl
        bg-[#0a0c10]/95 backdrop-blur-2xl border border-white/[0.08]
        shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
    >
      <header className="px-4 py-3 flex items-center justify-between border-b border-white/[0.05]">
        <p className="text-white text-[12px] font-medium tracking-wide">Capas</p>
        <button
          onClick={onClose}
          className="text-white/35 hover:text-white/85 w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/[0.05]"
        >
          <Icons.close size={12} />
        </button>
      </header>

      <section className="px-3 py-3 border-b border-white/[0.04]">
        <p className="text-white/35 text-[9px] uppercase tracking-[0.15em] mb-2 px-1">Estilo</p>
        <div className="grid grid-cols-3 gap-1">
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => setMapTheme(t.id)}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-medium tracking-wide transition-colors
                ${mapTheme === t.id
                  ? 'bg-white text-black'
                  : 'bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08]'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="px-3 py-3 border-b border-white/[0.04]">
        <p className="text-white/35 text-[9px] uppercase tracking-[0.15em] mb-2 px-1">Capas de datos</p>
        <div className="flex flex-col gap-1">
          {DATA_LAYERS.map(layer => {
            const isActive = activeLayers.includes(layer.id)
            return (
              <button
                key={layer.id}
                onClick={() => toggleLayer(layer.id)}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] transition-colors
                  ${isActive ? 'bg-white/[0.06] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white/85'}
                `}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all"
                  style={{
                    background: layer.color,
                    opacity: isActive ? 1 : 0.35,
                    boxShadow: isActive ? `0 0 8px ${layer.color}80` : 'none',
                  }}
                />
                <span className="flex-1 text-left">{layer.label}</span>
                {isActive && <span className="text-white/40 text-[10px]">on</span>}
              </button>
            )
          })}
        </div>
      </section>

      <section className="px-3 py-3">
        <p className="text-white/35 text-[9px] uppercase tracking-[0.15em] mb-2 px-1">Específico de Barcelona</p>
        <button
          onClick={toggleBeaches}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] transition-colors w-full
            ${showBeaches ? 'bg-white/[0.06] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white/85'}
          `}
        >
          <span className={showBeaches ? 'text-sky-300' : 'text-white/45'}>
            <Icons.beach size={13} />
          </span>
          <span className="flex-1 text-left">Platges</span>
          {showBeaches && <span className="text-white/40 text-[10px]">on</span>}
        </button>
      </section>
    </motion.div>
  )
}

function ProfileButton() {
  const { isLogged, user } = useAuthStore()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  if (!isLogged) {
    return (
      <>
        <button
          onClick={() => setShowLogin(true)}
          title="Iniciar sesión"
          className="w-11 h-11 flex items-center justify-center rounded-xl border
            bg-[#0a0c10]/85 backdrop-blur-xl text-white/50 border-white/[0.08]
            hover:text-white hover:border-white/[0.18] transition-all"
        >
          <Icons.user size={16} />
        </button>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      </>
    )
  }

  const initials = (user?.name ?? 'U').slice(0, 2).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-11 h-11 flex items-center justify-center rounded-xl border
          bg-cyan-500/10 border-cyan-500/30 text-cyan-300
          hover:bg-cyan-500/20 transition-all text-[11px] font-mono font-bold"
      >
        {initials}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -8, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute left-[60px] top-0 w-[180px] rounded-xl
              bg-[#0a0c10]/95 backdrop-blur-2xl border border-white/[0.08]
              shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-50"
          >
            <div className="px-3 py-2.5 border-b border-white/[0.06]">
              <p className="text-white/80 text-[12px] font-medium truncate">{user?.name}</p>
              <p className="text-white/35 text-[10px] font-mono truncate">{user?.email}</p>
            </div>
            <button
              onClick={async () => { setOpen(false); await logout() }}
              className="w-full text-left px-3 py-2.5 text-[12px] text-white/55
                hover:text-white hover:bg-white/[0.05] transition-colors font-mono"
            >
              Cerrar sesión
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FloatingToolbar() {
  const { view, openNearby, close } = useDrawerStore()
  const { activeCategory } = useNearbyStore()
  const { showBeaches, activeLayers } = (() => ({
    showBeaches:  useLeisureStore.getState().showBeaches,
    activeLayers: useMapStore.getState().activeLayers,
  }))()
  const showBeachesLive = useLeisureStore(s => s.showBeaches)
  const activeLayersLive = useMapStore(s => s.activeLayers)

  const [layersOpen, setLayersOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!layersOpen) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setLayersOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [layersOpen])

  const nearbyActive = view === 'nearby'
  const hasLayersOn  = showBeachesLive || activeLayersLive.length > 0

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6, duration: 0.3 }}
      className="absolute top-4 left-4 z-40 flex flex-col gap-2"
    >
      <ToolButton
        active={nearbyActive}
        onClick={() => {
          setLayersOpen(false)
          nearbyActive ? close() : openNearby()
        }}
        icon={Icons.search}
        label="Qué hay cerca"
        badge={activeCategory != null}
      />

      <div className="relative">
        <ToolButton
          active={layersOpen}
          onClick={() => setLayersOpen(v => !v)}
          icon={Icons.layers}
          label="Capas"
          badge={hasLayersOn}
        />
        <AnimatePresence>
          {layersOpen && <LayersPopover onClose={() => setLayersOpen(false)} />}
        </AnimatePresence>
      </div>

      <ProfileButton />
    </motion.div>
  )
}
