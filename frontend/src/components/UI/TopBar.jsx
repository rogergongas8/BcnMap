import React, { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Icons } from './icons'
import { useDrawerStore } from '../../store/drawerStore'
import { useMapStore } from '../../store/mapStore'
import { useLeisureStore } from '../../store/leisureStore'
import { useChatStore } from '../../store/chatStore'
import { useDataStore } from '../../store/dataStore'
import { useAuthStore } from '../../store/authStore'
import { useLangStore } from '../../store/langStore'
import { useAuth } from '../../hooks/useAuth'
import LoginModal from './LoginModal'
import CityHud from './CityHud'

const THEME_IDS  = ['dark', 'voyager', 'minimal']
const LAYER_DEFS = [
  { id: 'traffic', color: '#27AE60' },
  { id: 'bicing',  color: '#00aaff' },
  { id: 'bus',     color: '#FF6B35' },
  { id: 'metro',   color: '#A855F7' },
  { id: 'events',  color: '#C98E2E' },
]

const CARD_STYLE = {
  background:   '#151210',
  border:       '1px solid #2C2926',
  borderRadius: 8,
  boxShadow:    '0 2px 20px rgba(0,0,0,0.55)',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function IconBtn({ active, onClick, icon: Icon, label, badge, badgeColor = '#B8885A' }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
      style={{
        background: active ? '#B8885A1A' : '#211F1B',
        border:     `1px solid ${active ? '#B8885A' : '#2C2926'}`,
        color:      active ? '#B8885A' : '#8C8884',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = '#3D3A36'; e.currentTarget.style.color = '#B0ACA7' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = '#2C2926'; e.currentTarget.style.color = '#8C8884' } }}
    >
      <Icon size={14} />
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: badgeColor }} />
      )}
    </button>
  )
}

function LayersDropdown({ onClose }) {
  const { t } = useTranslation()
  const { mapTheme, setMapTheme, activeLayers, toggleLayer } = useMapStore()
  const { showBeaches, toggleBeaches } = useLeisureStore()
  const disruptions = useDataStore(s => s.disruptions)

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute top-10 left-0 z-[60] w-[230px] overflow-hidden"
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
                {layer.id === 'metro' && disruptions.length > 0 && (
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: '#D4555220', color: '#D45555', border: '1px solid #D4555240' }}>
                    {disruptions.length}
                  </span>
                )}
                {!(layer.id === 'metro' && disruptions.length > 0) && (
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

// ── Profile ───────────────────────────────────────────────────────────────────

function LangToggle() {
  const { t }           = useTranslation()
  const { lang, langs, setLang } = useLangStore()

  return (
    <div className="flex items-center gap-0.5">
      {langs.map(l => (
        <button
          key={l.id}
          onClick={() => setLang(l.id)}
          className="px-1.5 py-0.5 font-mono text-[9px] font-bold rounded transition-all"
          style={{
            background: lang === l.id ? '#B8885A' : 'transparent',
            color:      lang === l.id ? '#fff' : '#8C8884',
            border:     `1px solid ${lang === l.id ? '#B8885A' : 'transparent'}`,
          }}
        >{l.label}</button>
      ))}
    </div>
  )
}

function ProfileBtn() {
  const { t }              = useTranslation()
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
        <IconBtn onClick={() => setShowLogin(true)} icon={Icons.user} label={t('topbar.login')} />
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
          background: open ? '#B8885A1A' : '#211F1B',
          border: `1px solid ${open ? '#B8885A' : '#2C2926'}`,
          color: open ? '#B8885A' : '#F7F6F4',
        }}
      >{initials}</button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-11 right-0 w-[180px] z-[60] overflow-hidden pointer-events-auto"
            style={{ ...CARD_STYLE }}
          >
            <div className="px-3.5 py-3" style={{ borderBottom: '1px solid #201E1B' }}>
              <p className="font-syne text-[12px] font-medium truncate" style={{ color: '#F7F6F4' }}>{user?.name}</p>
              <p className="font-mono text-[10px] truncate mt-0.5" style={{ color: '#8C8884' }}>{user?.email}</p>
            </div>
            <button
              onClick={async () => { setOpen(false); await logout() }}
              className="w-full text-left px-3.5 py-2.5 font-mono text-[11px] transition-colors"
              style={{ color: '#B0ACA7' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F7F6F4'; e.currentTarget.style.background = '#211F1B' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#B0ACA7'; e.currentTarget.style.background = 'transparent' }}
            >{t('topbar.logout')}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── TopBar ────────────────────────────────────────────────────────────────────

export default function TopBar({ children }) {
  const { t } = useTranslation()
  const { view, openNearby, openSaved, openEvents, openDisruptions, close } = useDrawerStore()
  const disruptions = useDataStore(s => s.disruptions)
  const { activeLayers, toggleLayer } = useMapStore()
  const { showBeaches }  = useLeisureStore()
  const { isOpen: chatOpen, toggleChat, hasUnread } = useChatStore()

  useEffect(() => {
    if (view === 'events' && !activeLayers.includes('events')) toggleLayer('events')
    if (view !== 'events' &&  activeLayers.includes('events')) toggleLayer('events')
  }, [view])

  const nearbyActive       = view === 'nearby'
  const savedActive        = view === 'saved'
  const eventsActive       = view === 'events'
  const disruptionsActive  = view === 'disruptions'
  const hasDisruptions     = disruptions.length > 0

  return (
    <div className="absolute top-0 left-0 right-0 z-[60] flex items-center h-14 px-3 gap-2.5 overflow-visible pointer-events-none">
      {/* ── SearchBar: centered in viewport ── */}
      <div className="absolute inset-0 flex items-center justify-center overflow-visible pointer-events-none">
        <div className="pointer-events-auto overflow-visible">
          {children}
        </div>
      </div>

      {/* ── Left: Main navigation / feature toggles ── */}
      <div className="flex items-center gap-1 px-1.5 flex-shrink-0 pointer-events-auto" style={{ ...CARD_STYLE, height: 44 }}>
        <IconBtn active={nearbyActive}      onClick={() => nearbyActive      ? close() : openNearby()}      icon={Icons.search}   label={t('topbar.nearby')} />
        <IconBtn active={savedActive}       onClick={() => savedActive       ? close() : openSaved()}       icon={Icons.bookmark} label={t('topbar.saved')} />
        <IconBtn active={eventsActive}      onClick={() => eventsActive      ? close() : openEvents()}      icon={Icons.calendar} label={t('topbar.events')} />
        <IconBtn active={disruptionsActive} onClick={() => disruptionsActive ? close() : openDisruptions()} icon={Icons.alert}    label={t('topbar.disruptions')} badge={hasDisruptions} badgeColor="#D45555" />
      </div>

      {/* ── Weather HUD pill ── */}
      <div className="flex items-center flex-shrink-0 pointer-events-auto" style={{ ...CARD_STYLE, height: 44 }}>
        <CityHud />
      </div>

      {/* ── Center: truly centered in viewport ── */}
      <div className="flex-1 pointer-events-none" />

      {/* ── Right: Lang + Profile + Chat ── */}
      <div className="flex items-center gap-1 px-1.5 flex-shrink-0 pointer-events-auto transition-opacity" style={{ ...CARD_STYLE, height: 44, opacity: chatOpen ? 0 : 1, pointerEvents: chatOpen ? 'none' : 'auto' }}>
        <LangToggle />
        <div style={{ width: 1, height: 16, background: '#2C2926', flexShrink: 0, margin: '0 2px' }} />
        <ProfileBtn />
        <button
          onClick={toggleChat}
          title={t('topbar.chat')}
          className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
          style={{
            background: chatOpen ? '#B8885A1A' : 'transparent',
            border: `1px solid ${chatOpen ? '#B8885A' : 'transparent'}`,
            color: chatOpen ? '#B8885A' : '#8C8884',
          }}
          onMouseEnter={e => { if (!chatOpen) { e.currentTarget.style.color = '#B0ACA7' } }}
          onMouseLeave={e => { if (!chatOpen) { e.currentTarget.style.color = '#8C8884' } }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z"
              stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
            <circle cx="5.5" cy="7.5" r="0.8" fill="currentColor"/>
            <circle cx="8"   cy="7.5" r="0.8" fill="currentColor"/>
            <circle cx="10.5" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
          {hasUnread && !chatOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: '#B8885A' }} />
          )}
        </button>
      </div>
    </div>
  )
}
