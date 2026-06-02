import React, { useMemo, useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icons } from '../icons'
import { useDataStore } from '../../../store/dataStore'
import { useMapStore } from '../../../store/mapStore'
import { useChatStore } from '../../../store/chatStore'
import { useRouteStore } from '../../../store/routeStore'
import { useDrawerStore } from '../../../store/drawerStore'

const CATEGORIES = [
  { id: null,          label: 'Tots' },
  { id: 'musica',      label: 'Música' },
  { id: 'cultura',     label: 'Cultura' },
  { id: 'esport',      label: 'Esport' },
  { id: 'gastronomia', label: 'Gastro' },
  { id: 'familia',     label: 'Família' },
]

const CAT_COLOR = {
  musica:      '#C98E2E',
  esport:      '#3CB887',
  cultura:     '#8B6AD4',
  gastronomia: '#B8885A',
  familia:     '#4D84D4',
  altres:      '#5A5248',
}

const CAT_LABELS = {
  musica: 'Música', esport: 'Esport', cultura: 'Cultura',
  gastronomia: 'Gastro', familia: 'Família', altres: 'Altres',
}

function formatDate(start, end) {
  if (!start) return null
  const s = new Date(start + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

  const label = s.getTime() === today.getTime()   ? 'Avui'
              : s.getTime() === tomorrow.getTime() ? 'Demà'
              : s.toLocaleDateString('ca', { day: 'numeric', month: 'short' })

  if (end && end !== start) {
    const e = new Date(end + 'T00:00:00')
    return `${label} → ${e.toLocaleDateString('ca', { day: 'numeric', month: 'short' })}`
  }
  return label
}

function SearchAndFilter({ search, onSearch, activeCategory, onCategory }) {
  const inputRef = React.useRef(null)
  return (
    <div className="flex flex-col gap-0" style={{ borderBottom: '1px solid #2C2926' }}>
      {/* Text search */}
      <div className="px-3 pt-2.5 pb-2 flex items-center gap-2"
        style={{ borderBottom: '1px solid #201E1B' }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: '#8C8884', flexShrink: 0 }}>
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
          <line x1="10.7" y1="10.7" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Cerca per nom, lloc…"
          className="flex-1 bg-transparent font-mono text-[11px] outline-none placeholder-[#3A3530]"
          style={{ color: '#F7F6F4' }}
        />
        {search && (
          <button onClick={() => { onSearch(''); inputRef.current?.focus() }}
            style={{ color: '#8C8884' }}
            onMouseEnter={e => e.currentTarget.style.color = '#B0ACA7'}
            onMouseLeave={e => e.currentTarget.style.color = '#8C8884'}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Category rail */}
      <div className="px-3 py-2" >
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id
            const color = cat.id ? CAT_COLOR[cat.id] : '#B8885A'
            return (
              <button
                key={String(cat.id)}
                onClick={() => onCategory(cat.id)}
                className="flex-shrink-0 px-2.5 py-1 whitespace-nowrap font-syne text-[10px] transition-all"
                style={{
                  borderRadius: 5,
                  fontWeight: isActive ? 600 : 400,
                  border: `1px solid ${isActive ? color : '#2C2926'}`,
                  background: isActive ? color + '18' : 'transparent',
                  color: isActive ? color : '#9A9692',
                }}
              >
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EventRow({ event, expanded, onToggle, rowRef }) {
  const flyTo               = useMapStore(s => s.flyTo)
  const userLocation        = useMapStore(s => s.userLocation)
  const openChatWithPromptNoFly = useChatStore(s => s.openChatWithPromptNoFly)
  const setChatRequest      = useRouteStore(s => s.setChatRequest)
  const color = CAT_COLOR[event.category] ?? CAT_COLOR.altres

  const handleNavigate = () => {
    if (!event.lat || !event.lng) return
    const dest   = { lat: event.lat, lng: event.lng, label: event.place || event.title }
    const origin = userLocation ? { lat: userLocation.lat, lng: userLocation.lng, label: 'Mi ubicación' } : null
    setChatRequest({ origin, destination: dest, mode: 'foot' })
    flyTo({ lat: event.lat, lng: event.lng, zoom: 15 })
  }

  const handleClick = () => {
    onToggle()
    if (event.lat && event.lng) {
      flyTo({ lat: event.lat, lng: event.lng, zoom: 16 })
    }
  }

  const sourceLabel = event.source === 'ticketmaster' ? 'Ticketmaster'
    : event.source === 'songkick' ? 'Songkick'
    : null

  return (
    <li ref={rowRef} style={{ borderBottom: '1px solid #201E1B' }}>
      {/* ── Row header ── */}
      <div
        onClick={handleClick}
        className="flex cursor-pointer transition-colors"
        style={{ background: expanded ? '#211F1B' : 'transparent' }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = '#181818' }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
      >
        <div className="w-[3px] flex-shrink-0 self-stretch" style={{ background: color, opacity: expanded ? 1 : 0.5 }} />
        <div className="px-3.5 py-3 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-syne text-[13px] font-medium leading-snug" style={{ color: '#F7F6F4' }}>
              {event.title}
            </p>
            <span
              className="flex-shrink-0 mt-0.5 transition-transform"
              style={{ color: '#7D7975', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <Icons.chevronDown size={11} />
            </span>
          </div>
          {event.place && (
            <p className="font-mono text-[10px] truncate mt-0.5" style={{ color: '#9A9692' }}>
              {event.place}{event.district ? ` · ${event.district}` : ''}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className="font-mono text-[8px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: color + '18', color, border: `1px solid ${color}33` }}
            >
              {CAT_LABELS[event.category] ?? event.category}
            </span>
            {event.start && (
              <span className="font-mono text-[9px]" style={{ color: '#8C8884' }}>
                {formatDate(event.start, event.end)}
                {event.time && ` · ${event.time}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded detail ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden', background: '#181512', borderTop: '1px solid #222' }}
          >
            <div className="px-4 py-3 flex flex-col gap-2.5">

              {/* Timetable */}
              {event.timetable && (
                <div className="flex items-start gap-2">
                  <span style={{ color: '#8C8884', flexShrink: 0, marginTop: 1 }}><Icons.clock size={11} /></span>
                  <p className="font-mono text-[10px] leading-relaxed" style={{ color: '#B0ACA7' }}>{event.timetable}</p>
                </div>
              )}

              {/* Venue + district */}
              {(event.place || event.district) && (
                <div className="flex items-start gap-2">
                  <span style={{ color: '#8C8884', flexShrink: 0, marginTop: 1 }}><Icons.pin size={11} /></span>
                  <p className="font-mono text-[10px]" style={{ color: '#B0ACA7' }}>
                    {[event.place, event.district].filter(Boolean).join(' · ')}
                  </p>
                </div>
              )}

              {/* Date range */}
              {event.start && (
                <div className="flex items-start gap-2">
                  <span style={{ color: '#8C8884', flexShrink: 0, marginTop: 1 }}><Icons.calendar size={11} /></span>
                  <div>
                    <p className="font-mono text-[10px]" style={{ color: '#B0ACA7' }}>
                      {formatDate(event.start, event.end)}
                      {event.time && ` · ${event.time}h`}
                    </p>
                    {(() => {
                      const extras = typeof event.extra_dates === 'string'
                        ? JSON.parse(event.extra_dates || '[]')
                        : (event.extra_dates ?? [])
                      if (!extras.length) return null
                      const labels = extras.slice(0, 4).map(d => {
                        const dt = new Date(d + 'T00:00:00')
                        return dt.toLocaleDateString('ca', { day: 'numeric', month: 'short' })
                      })
                      return (
                        <p className="font-mono text-[9px] mt-0.5" style={{ color: '#8C8884' }}>
                          Tb: {labels.join(', ')}{extras.length > 4 ? '…' : ''}
                        </p>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* Source */}
              {sourceLabel && (
                <p className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: '#3A3530' }}>
                  via {sourceLabel}
                </p>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-1.5 mt-1">
                {/* Primary: navigate */}
                {event.lat && event.lng && (
                  <button
                    onClick={handleNavigate}
                    className="w-full flex items-center justify-center gap-2 py-2.5 font-syne text-[12px] font-semibold transition-colors"
                    style={{ borderRadius: 6, background: '#B8885A', color: '#fff' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#d4541f'}
                    onMouseLeave={e => e.currentTarget.style.background = '#B8885A'}
                  >
                    <Icons.navigation size={12} />
                    Porta'm aquí
                  </button>
                )}

                <div className="flex gap-1.5">
                  {event.url && (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 font-syne text-[11px] font-medium transition-colors"
                      style={{ borderRadius: 6, background: color + '18', border: `1px solid ${color}44`, color }}
                      onMouseEnter={e => e.currentTarget.style.background = color + '28'}
                      onMouseLeave={e => e.currentTarget.style.background = color + '18'}
                    >
                      <Icons.forward size={11} />
                      {event.source === 'ticketmaster' ? 'Entrades' : 'Més info'}
                    </a>
                  )}
                  <button
                    onClick={() => openChatWithPromptNoFly(`Explica'm més sobre "${event.title}"${event.place ? ` a ${event.place}` : ''}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 font-syne text-[11px] font-medium transition-colors"
                    style={{ borderRadius: 6, background: '#211F1B', border: '1px solid #2A2A2A', color: '#B0ACA7' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#B8885A'; e.currentTarget.style.color = '#B8885A' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A2A'; e.currentTarget.style.color = '#B0ACA7' }}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                      <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z"
                        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                      <circle cx="5.5" cy="7.5" r="0.8" fill="currentColor"/>
                      <circle cx="8" cy="7.5" r="0.8" fill="currentColor"/>
                      <circle cx="10.5" cy="7.5" r="0.8" fill="currentColor"/>
                    </svg>
                    Preguntar
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

export default function EventsView() {
  const events             = useDataStore(s => s.events)
  const openChatWithPrompt = useChatStore(s => s.openChatWithPrompt)
  const focusedEventKey    = useDrawerStore(s => s.focusedEventKey)
  const clearEventFocus    = useDrawerStore(s => s.clearEventFocus)
  const eventsCategory     = useDrawerStore(s => s.eventsCategory)
  const [activeCategory, setActiveCategory] = useState(eventsCategory)
  const [searchQuery,    setSearchQuery]    = useState('')
  const [expandedId,     setExpandedId]     = useState(null)
  const rowRefs = useRef({})
  const listRef = useRef(null)

  useEffect(() => {
    if (!focusedEventKey) return
    const [focusTitle, focusStart] = focusedEventKey.split('|')
    const idx = events.findIndex(e => e.title === focusTitle && (e.start ?? '') === (focusStart ?? ''))
    if (idx === -1) { clearEventFocus(); return }
    const e  = events[idx]
    const id = `${e.title}-${e.start}-${idx}`
    setActiveCategory(null)
    setExpandedId(id)
    clearEventFocus()
    requestAnimationFrame(() => {
      rowRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [focusedEventKey])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const base = events.filter(e => {
      if (activeCategory && e.category !== activeCategory) return false
      if (q) {
        const haystack = [e.title, e.place, e.district].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    return [...base].sort((a, b) => {
      if (a.today && !b.today) return -1
      if (!a.today && b.today) return 1
      if (a.start && b.start && a.start !== b.start) return a.start.localeCompare(b.start)
      if (a.time && b.time) return a.time.localeCompare(b.time)
      return 0
    })
  }, [events, activeCategory, searchQuery])

  const activeMeta = CATEGORIES.find(c => c.id === activeCategory)

  return (
    <>
      <SearchAndFilter
        search={searchQuery}
        onSearch={setSearchQuery}
        activeCategory={activeCategory}
        onCategory={setActiveCategory}
      />

      <div className="flex-1 overflow-y-auto min-h-0">
        {events.length === 0 && (
          <div className="px-6 py-12 flex flex-col items-center text-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#211F1B', color: '#8C8884' }}>
              <Icons.calendar size={15} />
            </div>
            <p className="font-syne text-[13px]" style={{ color: '#B0ACA7' }}>Carregant esdeveniments…</p>
          </div>
        )}

        {events.length > 0 && filtered.length === 0 && (
          <div className="px-6 py-12 flex flex-col items-center text-center gap-2">
            <p className="font-syne text-[13px]" style={{ color: '#B0ACA7' }}>
              {searchQuery ? `Sense resultats per "${searchQuery}"` : `Sense ${activeMeta?.label.toLowerCase()} per avui`}
            </p>
            <button
              onClick={() => { setActiveCategory(null); setSearchQuery('') }}
              className="font-mono text-[10px] underline"
              style={{ color: '#8C8884' }}
            >
              Veure tots
            </button>
          </div>
        )}

        {filtered.length > 0 && (
          <>
            <div className="px-4 py-2" style={{ borderBottom: '1px solid #201E1B' }}>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: '#3A3530' }}>
                {filtered.length} de {events.length}
                {activeCategory ? ` · ${activeMeta?.label}` : ''}
                {searchQuery ? ` · "${searchQuery}"` : ''}
              </span>
            </div>

            <ul>
              {filtered.map((event, i) => {
                const id = `${event.title}-${event.start}-${i}`
                return (
                  <EventRow
                    key={id}
                    rowRef={el => { rowRefs.current[id] = el }}
                    event={event}
                    expanded={expandedId === id}
                    onToggle={() => {
                      const next = expandedId === id ? null : id
                      setExpandedId(next)
                      if (next === id) {
                        setTimeout(() => {
                          rowRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }, 160)
                      }
                    }}
                  />
                )
              })}
            </ul>

            <div className="px-4 py-3" style={{ borderTop: '1px solid #2C2926' }}>
              <button
                onClick={() => openChatWithPrompt(
                  activeCategory
                    ? `Quin esdeveniment de ${activeMeta?.label.toLowerCase()} recomanaries avui a Barcelona?`
                    : `Quins esdeveniments destacats hi ha avui a Barcelona?`
                )}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 transition-colors"
                style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 6,
                  border: '1px solid #2C2926',
                  background: '#211F1B',
                  color: '#B0ACA7',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#B8885A'; e.currentTarget.style.color = '#B8885A' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2C2926'; e.currentTarget.style.color = '#B0ACA7' }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z"
                    stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                  <circle cx="5.5" cy="7.5" r="0.8" fill="currentColor"/>
                  <circle cx="8"   cy="7.5" r="0.8" fill="currentColor"/>
                  <circle cx="10.5" cy="7.5" r="0.8" fill="currentColor"/>
                </svg>
                Preguntar a l'assistent
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
