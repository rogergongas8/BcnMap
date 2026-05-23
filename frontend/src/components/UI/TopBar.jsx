import React, { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icons } from './icons'
import { useDrawerStore } from '../../store/drawerStore'
import { useMapStore } from '../../store/mapStore'
import { useLeisureStore } from '../../store/leisureStore'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { useAuth } from '../../hooks/useAuth'
import LoginModal from './LoginModal'
import CityHud from './CityHud'

const THEMES = [
  { id: 'dark',    label: 'Fosc' },
  { id: 'voyager', label: 'Estàndard' },
  { id: 'minimal', label: 'Minimal' },
]

const DATA_LAYERS = [
  { id: 'traffic', label: 'Trànsit', color: '#27AE60' },
  { id: 'bicing',  label: 'Bicing',  color: '#00aaff' },
  { id: 'bus',     label: 'Bus',     color: '#FF6B35' },
  { id: 'metro',   label: 'Metro',   color: '#A855F7' },
  { id: 'events',  label: 'Esdeveniments', color: '#C98E2E' },
]

const CARD_STYLE = {
  background:   '#141414',
  border:       '1px solid #262626',
  borderRadius: 8,
  boxShadow:    '0 2px 16px rgba(0,0,0,0.45)',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function IconBtn({ active, onClick, icon: Icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
      style={{
        background: active ? '#E8622A1A' : '#1C1C1C',
        border:     `1px solid ${active ? '#E8622A' : '#262626'}`,
        color:      active ? '#E8622A' : '#555',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = '#3a3a3a'; e.currentTarget.style.color = '#888' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = '#262626'; e.currentTarget.style.color = '#555' } }}
    >
      <Icon size={14} />
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: '#E8622A' }} />
      )}
    </button>
  )
}

function LayersDropdown({ onClose }) {
  const { mapTheme, setMapTheme, activeLayers, toggleLayer } = useMapStore()
  const { showBeaches, toggleBeaches } = useLeisureStore()

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute top-10 left-0 z-[60] w-[230px] overflow-hidden"
      style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}
    >
      <header className="px-3.5 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid #1A1A1A' }}>
        <p className="font-syne text-[12px] font-medium" style={{ color: '#EBEBEB' }}>Capes i estil</p>
        <button onClick={onClose} style={{ color: '#555' }}>
          <Icons.close size={10} />
        </button>
      </header>

      <section className="px-3 py-2.5" style={{ borderBottom: '1px solid #1A1A1A' }}>
        <p className="font-mono text-[9px] uppercase tracking-[0.15em] mb-2" style={{ color: '#555' }}>Estil del mapa</p>
        <div className="grid grid-cols-3 gap-1">
          {THEMES.map(t => (
            <button key={t.id} onClick={() => setMapTheme(t.id)}
              className="py-1.5 font-syne text-[10px] font-medium transition-colors"
              style={{
                borderRadius: 6,
                background: mapTheme === t.id ? '#E8622A' : '#1C1C1C',
                border: `1px solid ${mapTheme === t.id ? '#E8622A' : '#262626'}`,
                color: mapTheme === t.id ? '#fff' : '#888',
              }}
            >{t.label}</button>
          ))}
        </div>
      </section>

      <section className="px-3 py-2.5" style={{ borderBottom: '1px solid #1A1A1A' }}>
        <p className="font-mono text-[9px] uppercase tracking-[0.15em] mb-2" style={{ color: '#555' }}>Dades en temps real</p>
        <div className="flex flex-col gap-0.5">
          {DATA_LAYERS.map(layer => {
            const on = activeLayers.includes(layer.id)
            return (
              <button key={layer.id} onClick={() => toggleLayer(layer.id)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 w-full transition-colors"
                style={{ borderRadius: 6, background: on ? '#1C1C1C' : 'transparent' }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: layer.color, opacity: on ? 1 : 0.35 }} />
                <span className="font-syne text-[11px] flex-1 text-left" style={{ color: on ? '#EBEBEB' : '#888' }}>{layer.label}</span>
                <span className="font-mono text-[9px]" style={{ color: on ? '#E8622A' : 'transparent' }}>on</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="px-3 py-2.5">
        <button onClick={toggleBeaches}
          className="flex items-center gap-2.5 px-2.5 py-1.5 w-full transition-colors"
          style={{ borderRadius: 6, background: showBeaches ? '#1C1C1C' : 'transparent' }}
        >
          <Icons.beach size={12} style={{ color: showBeaches ? '#4D84D4' : '#555', flexShrink: 0 }} />
          <span className="font-syne text-[11px] flex-1 text-left" style={{ color: showBeaches ? '#EBEBEB' : '#888' }}>Platges</span>
          <span className="font-mono text-[9px]" style={{ color: showBeaches ? '#E8622A' : 'transparent' }}>on</span>
        </button>
      </section>
    </motion.div>
  )
}

// ── Profile ───────────────────────────────────────────────────────────────────

function ProfileBtn() {
  const { isLogged, user } = useAuthStore()
  const { logout }         = useAuth()
  const [open, setOpen]    = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  if (!isLogged) {
    return (
      <>
        <IconBtn onClick={() => setShowLogin(true)} icon={Icons.user} label="Iniciar sessió" />
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      </>
    )
  }

  const initials = (user?.name ?? 'U').slice(0, 2).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-9 h-9 flex items-center justify-center rounded-lg font-mono text-[11px] font-bold transition-all"
        style={{
          background: open ? '#E8622A1A' : '#1C1C1C',
          border: `1px solid ${open ? '#E8622A' : '#262626'}`,
          color: open ? '#E8622A' : '#EBEBEB',
        }}
      >{initials}</button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute top-11 right-0 w-[180px] z-[60] overflow-hidden"
            style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}
          >
            <div className="px-3.5 py-3" style={{ borderBottom: '1px solid #1A1A1A' }}>
              <p className="font-syne text-[12px] font-medium truncate" style={{ color: '#EBEBEB' }}>{user?.name}</p>
              <p className="font-mono text-[10px] truncate mt-0.5" style={{ color: '#555' }}>{user?.email}</p>
            </div>
            <button
              onClick={async () => { setOpen(false); await logout() }}
              className="w-full text-left px-3.5 py-2.5 font-mono text-[11px] transition-colors"
              style={{ color: '#888' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#EBEBEB'; e.currentTarget.style.background = '#1C1C1C' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.background = 'transparent' }}
            >Tancar sessió</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── TopBar ────────────────────────────────────────────────────────────────────

export default function TopBar({ children }) {
  const { view, openNearby, openSaved, openEvents, close } = useDrawerStore()
  const { activeLayers } = useMapStore()
  const { showBeaches }  = useLeisureStore()
  const { isOpen: chatOpen, toggleChat, hasUnread } = useChatStore()

  const [layersOpen, setLayersOpen] = useState(false)
  const layersRef = useRef(null)

  useEffect(() => {
    if (view) setLayersOpen(false)
  }, [view])

  useEffect(() => {
    if (!layersOpen) return
    const handler = e => { if (layersRef.current && !layersRef.current.contains(e.target)) setLayersOpen(false) }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [layersOpen])

  const nearbyActive = view === 'nearby'
  const savedActive  = view === 'saved'
  const eventsActive = view === 'events'
  const hasLayersOn  = showBeaches || activeLayers.length > 0

  return (
    <div className="absolute top-0 left-0 right-0 z-50 flex items-center h-14 px-3 gap-2.5 overflow-visible pointer-events-none">
      {/* ── SearchBar: centered in viewport ── */}
      <div className="absolute inset-0 flex items-center justify-center overflow-visible pointer-events-none">
        <div className="pointer-events-auto overflow-visible">
          {children}
        </div>
      </div>

      {/* ── Left: action buttons ── */}
      <div className="flex items-center gap-1 px-1.5 flex-shrink-0 pointer-events-auto" style={{ ...CARD_STYLE, height: 44 }}>
        <IconBtn active={nearbyActive} onClick={() => nearbyActive ? close() : openNearby()} icon={Icons.search}   label="A prop" />
        <IconBtn active={savedActive}  onClick={() => savedActive  ? close() : openSaved()}  icon={Icons.bookmark} label="Guardats" />
        <IconBtn active={eventsActive} onClick={() => eventsActive ? close() : openEvents()} icon={Icons.calendar} label="Esdeveniments" />
        <div ref={layersRef} className="relative">
          <IconBtn active={layersOpen} onClick={() => { const next = !layersOpen; if (next && view) close(); setLayersOpen(next) }} icon={Icons.layers} label="Capes" badge={hasLayersOn} />
          <AnimatePresence>
            {layersOpen && <LayersDropdown onClose={() => setLayersOpen(false)} />}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Center: truly centered in viewport ── */}
      <div className="flex-1 pointer-events-none" />

      {/* ── Right: HUD + Profile + Chat ── */}
      <div className="flex items-center gap-1 px-1.5 flex-shrink-0 pointer-events-auto" style={{ ...CARD_STYLE, height: 44 }}>
        <CityHud />
        <div style={{ width: 1, height: 16, background: '#262626', flexShrink: 0, margin: '0 2px' }} />
        <ProfileBtn />
        <button
          onClick={toggleChat}
          title="Chat IA"
          className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
          style={{
            background: chatOpen ? '#E8622A1A' : 'transparent',
            border: `1px solid ${chatOpen ? '#E8622A' : 'transparent'}`,
            color: chatOpen ? '#E8622A' : '#555',
          }}
          onMouseEnter={e => { if (!chatOpen) { e.currentTarget.style.color = '#888' } }}
          onMouseLeave={e => { if (!chatOpen) { e.currentTarget.style.color = '#555' } }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z"
              stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
            <circle cx="5.5" cy="7.5" r="0.8" fill="currentColor"/>
            <circle cx="8"   cy="7.5" r="0.8" fill="currentColor"/>
            <circle cx="10.5" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
          {hasUnread && !chatOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: '#E8622A' }} />
          )}
        </button>
      </div>
    </div>
  )
}
