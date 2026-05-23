import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMapStore } from '../../store/mapStore'
import { useRouteStore } from '../../store/routeStore'
import { useChatStore } from '../../store/chatStore'

const CAT_COLOR = {
  musica:      '#C98E2E',
  esport:      '#3CB887',
  cultura:     '#8B6AD4',
  gastronomia: '#E8622A',
  familia:     '#4D84D4',
  altres:      '#5A5248',
}

const CAT_LABELS = {
  musica: 'Música', esport: 'Esport', cultura: 'Cultura',
  gastronomia: 'Gastro', familia: 'Família', altres: 'Altres',
}

function formatDate(start, end) {
  if (!start) return null
  const s     = new Date(start + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tom   = new Date(today); tom.setDate(tom.getDate() + 1)
  const label = s.getTime() === today.getTime() ? 'Avui'
              : s.getTime() === tom.getTime()   ? 'Demà'
              : s.toLocaleDateString('ca', { day: 'numeric', month: 'short' })
  if (end && end !== start) {
    const e = new Date(end + 'T00:00:00')
    return `${label} → ${e.toLocaleDateString('ca', { day: 'numeric', month: 'short' })}`
  }
  return label
}

export default function EventPopup({ popup, onClose }) {
  const { event, x, y } = popup ?? {}
  const userLocation       = useMapStore(s => s.userLocation)
  const flyTo              = useMapStore(s => s.flyTo)
  const setChatRequest     = useRouteStore(s => s.setChatRequest)
  const openChatWithPromptNoFly = useChatStore(s => s.openChatWithPromptNoFly)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!event) return null

  const color = CAT_COLOR[event.category] ?? CAT_COLOR.altres

  const handleNavigate = () => {
    if (!event.lat || !event.lng) return
    const dest   = { lat: parseFloat(event.lat), lng: parseFloat(event.lng), label: event.place || event.title }
    const origin = userLocation ? { lat: userLocation.lat, lng: userLocation.lng, label: 'Mi ubicación' } : null
    setChatRequest({ origin, destination: dest, mode: 'foot' })
    flyTo({ lat: parseFloat(event.lat), lng: parseFloat(event.lng), zoom: 15 })
    onClose()
  }

  // Position popup above the click point; clamp so it doesn't go off-screen
  const popupW = 272
  const popupH = 200 // approximate, adjusts dynamically
  const left   = Math.max(8, Math.min(x - popupW / 2, window.innerWidth - popupW - 8))
  const top    = Math.max(64, y - popupH - 16)

  return (
    <AnimatePresence>
      {popup && (
        <>
          {/* Backdrop to catch outside clicks */}
          <div className="fixed inset-0 z-[70]" onClick={onClose} />

          <motion.div
            key="event-popup"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="fixed z-[71] overflow-hidden"
            style={{
              left,
              top,
              width: popupW,
              background: '#141414',
              border: '1px solid #2A2A2A',
              borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            }}
          >
            {/* Color bar */}
            <div style={{ height: 3, background: color }} />

            <div className="px-3.5 pt-3 pb-3.5 flex flex-col gap-2">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <p className="font-syne text-[13px] font-semibold leading-snug flex-1" style={{ color: '#EBEBEB' }}>
                  {event.title}
                </p>
                <button
                  onClick={onClose}
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded"
                  style={{ color: '#555', background: 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#888'}
                  onMouseLeave={e => e.currentTarget.style.color = '#555'}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              {/* Meta */}
              <div className="flex flex-col gap-1">
                {event.place && (
                  <p className="font-mono text-[10px] truncate" style={{ color: '#666' }}>
                    {event.place}{event.district ? ` · ${event.district}` : ''}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="font-mono text-[8px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded"
                    style={{ background: color + '18', color, border: `1px solid ${color}33` }}
                  >
                    {CAT_LABELS[event.category] ?? event.category}
                  </span>
                  {event.start && (
                    <span className="font-mono text-[9px]" style={{ color: '#555' }}>
                      {formatDate(event.start, event.end)}
                      {event.time && ` · ${event.time}h`}
                    </span>
                  )}
                </div>
                {event.timetable && (
                  <p className="font-mono text-[9px] leading-relaxed" style={{ color: '#555' }}>
                    {event.timetable}
                  </p>
                )}
                {(() => {
                  const extras = typeof event.extra_dates === 'string'
                    ? JSON.parse(event.extra_dates || '[]')
                    : (event.extra_dates ?? [])
                  if (!extras.length) return null
                  const labels = extras.slice(0, 3).map(d => {
                    const dt = new Date(d + 'T00:00:00')
                    return dt.toLocaleDateString('ca', { day: 'numeric', month: 'short' })
                  })
                  return (
                    <p className="font-mono text-[9px]" style={{ color: '#555' }}>
                      Tb: {labels.join(', ')}{extras.length > 3 ? '…' : ''}
                    </p>
                  )
                })()}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1.5 mt-0.5">
                {event.lat && event.lng && (
                  <button
                    onClick={handleNavigate}
                    className="w-full py-2 font-syne text-[12px] font-semibold transition-colors"
                    style={{ borderRadius: 6, background: '#E8622A', color: '#fff' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#d4541f'}
                    onMouseLeave={e => e.currentTarget.style.background = '#E8622A'}
                  >
                    Porta'm aquí
                  </button>
                )}
                <div className="flex gap-1.5">
                  {event.url && (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center py-1.5 font-syne text-[10px] font-medium transition-colors"
                      style={{ borderRadius: 6, background: color + '18', border: `1px solid ${color}44`, color }}
                    >
                      {event.source === 'ticketmaster' ? 'Entrades' : 'Més info'}
                    </a>
                  )}
                  <button
                    onClick={() => {
                      openChatWithPromptNoFly(`Explica'm més sobre "${event.title}"${event.place ? ` a ${event.place}` : ''}`)
                      onClose()
                    }}
                    className="flex-1 flex items-center justify-center py-1.5 font-syne text-[10px] font-medium transition-colors"
                    style={{ borderRadius: 6, background: '#1C1C1C', border: '1px solid #2A2A2A', color: '#888' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8622A'; e.currentTarget.style.color = '#E8622A' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A2A'; e.currentTarget.style.color = '#888' }}
                  >
                    Preguntar
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
