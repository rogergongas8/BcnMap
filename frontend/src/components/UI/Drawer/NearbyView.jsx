import React from 'react'
import { Icons } from '../icons'
import { useNearbyStore, NEARBY_CATEGORIES } from '../../../store/nearbyStore'
import { useDrawerStore } from '../../../store/drawerStore'
import { useMapStore } from '../../../store/mapStore'
import { useChatStore } from '../../../store/chatStore'
import { useNearbyPois } from '../../../hooks/useNearbyPois'

function formatDistance(m) {
  if (m == null) return ''
  if (m < 1000) return `${m} m`
  return `${(m / 1000).toFixed(1)} km`
}

function CategoryRail() {
  const { activeCategory, setCategory } = useNearbyStore()

  return (
    <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #2C2926' }}>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mb-1">
        {NEARBY_CATEGORIES.map(cat => {
          const Icon   = cat.icon
          const active = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 whitespace-nowrap transition-all duration-150"
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                borderRadius: 6,
                border: `1px solid ${active ? '#B8885A' : '#2C2926'}`,
                background: active ? '#B8885A' : '#211F1B',
                color: active ? '#fff' : '#B0ACA7',
              }}
            >
              <span style={{ color: active ? '#fff' : '#8C8884' }}><Icon size={12} /></span>
              <span>{cat.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const EVT_COLORS = {
  musica: '#C98E2E', esport: '#3CB887', cultura: '#8B6AD4',
  gastronomia: '#B8885A', familia: '#4D84D4', altres: '#5A5248',
}

function formatEvtDate(start) {
  if (!start) return null
  const d = new Date(start + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.getTime() === today.getTime()) return 'Avui'
  if (d.getTime() === tomorrow.getTime()) return 'Demà'
  return d.toLocaleDateString('ca', { day: 'numeric', month: 'short' })
}

function EventRow({ evt, onSelect, isHovered, onHover }) {
  const color = EVT_COLORS[evt.category] ?? '#5A5248'
  return (
    <li
      onClick={() => onSelect(evt)}
      onMouseEnter={() => onHover(evt.id)}
      onMouseLeave={() => onHover(null)}
      className="flex cursor-pointer transition-colors"
      style={{ borderBottom: '1px solid #201E1B', background: isHovered ? '#211F1B' : 'transparent' }}
    >
      <div className="w-[3px] flex-shrink-0 self-stretch transition-colors" style={{ background: isHovered ? color : 'transparent' }} />
      <div className="flex items-start gap-3 px-3.5 py-3 flex-1 min-w-0">
        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 font-mono text-[8px] font-bold uppercase"
          style={{ background: color + '18', color, border: `1px solid ${color}33` }}>
          {(evt.category ?? 'ev').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-syne text-[13px] font-medium leading-tight truncate" style={{ color: '#F7F6F4' }}>{evt.name}</p>
            {evt.distance_m != null && (
              <span className="font-mono text-[10px] flex-shrink-0" style={{ color: '#8C8884' }}>{formatDistance(evt.distance_m)}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {evt.place && <p className="font-mono text-[10px] truncate" style={{ color: '#8C8884' }}>{evt.place}</p>}
            {evt.date_start && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: color + '18', color }}>
                {formatEvtDate(evt.date_start)}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

function PoiRow({ poi, categoryIcon, onSelect, onHover, isHovered }) {
  const Icon = categoryIcon

  return (
    <li
      onClick={() => onSelect(poi)}
      onMouseEnter={() => onHover(poi.id)}
      onMouseLeave={() => onHover(null)}
      className="flex cursor-pointer transition-colors"
      style={{
        borderBottom: '1px solid #201E1B',
        background: isHovered ? '#211F1B' : 'transparent',
      }}
    >
      {/* Accent bar */}
      <div className="w-[3px] flex-shrink-0 self-stretch" style={{ background: isHovered ? '#B8885A' : 'transparent', transition: 'background 0.15s' }} />

      <div className="flex items-start gap-3 px-3.5 py-3 flex-1 min-w-0">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: '#2C2926', color: '#B0ACA7' }}
        >
          <Icon size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-syne text-[13px] font-medium leading-tight truncate" style={{ color: '#F7F6F4' }}>
              {poi.name}
            </p>
            {poi.distance_m != null && (
              <span className="font-mono text-[10px] flex-shrink-0 tabular-nums" style={{ color: '#8C8884' }}>
                {formatDistance(poi.distance_m)}
              </span>
            )}
          </div>
          {poi.address && (
            <p className="font-mono text-[10px] truncate mt-0.5" style={{ color: '#8C8884' }}>{poi.address}</p>
          )}
          {poi.cuisine && (
            <p className="font-mono text-[10px] mt-0.5 capitalize" style={{ color: '#8C8884' }}>
              {poi.cuisine.replace(/_/g, ' · ')}
            </p>
          )}
        </div>
      </div>
    </li>
  )
}

export default function NearbyView() {
  useNearbyPois()
  const { activeCategory, pois, isLoading, hoveredId, setHovered } = useNearbyStore()
  const openPlace          = useDrawerStore(s => s.openPlace)
  const flyTo              = useMapStore(s => s.flyTo)
  const openChatWithPrompt = useChatStore(s => s.openChatWithPrompt)

  const activeMeta = NEARBY_CATEGORIES.find(c => c.id === activeCategory)
  const isEventsMode = activeCategory === 'events'

  const handleSelect = (item) => {
    flyTo({ lat: item.lat, lng: item.lng, zoom: 16 })
    if (isEventsMode) return  // just fly — events have no PlaceView
    openPlace({
      kind:     'poi',
      id:       item.id,
      name:     item.name,
      lat:      item.lat,
      lng:      item.lng,
      address:  item.address,
      meta:     item,
      category: activeMeta,
    })
  }

  return (
    <>
      <CategoryRail />

      <div className="flex-1 overflow-y-auto min-h-0">
        {!activeCategory && (
          <div className="px-6 py-12 flex flex-col items-center text-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#211F1B', color: '#8C8884' }}>
              <Icons.search size={15} />
            </div>
            <p className="font-syne text-[13px] leading-snug max-w-[200px]" style={{ color: '#B0ACA7' }}>
              Selecciona una categoría per descobrir llocs a prop
            </p>
            <p className="font-mono text-[10px]" style={{ color: '#8C8884' }}>
              {NEARBY_CATEGORIES.length} categories disponibles
            </p>
          </div>
        )}

        {activeCategory && isLoading && (
          <ul>
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex" style={{ borderBottom: '1px solid #201E1B' }}>
                <div className="w-[3px] flex-shrink-0" />
                <div className="flex items-center gap-3 px-3.5 py-3 flex-1">
                  <div className="w-7 h-7 rounded-md flex-shrink-0 animate-pulse" style={{ background: '#2C2926' }} />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="h-3 rounded animate-pulse" style={{ background: '#2C2926', width: `${55 + (i % 3) * 15}%` }} />
                    <div className="h-2.5 rounded animate-pulse" style={{ background: '#211F1B', width: `${35 + (i % 4) * 12}%` }} />
                  </div>
                  <div className="w-8 h-2.5 rounded animate-pulse flex-shrink-0" style={{ background: '#211F1B' }} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {activeCategory && !isLoading && pois.length === 0 && (
          <div className="px-6 py-12 flex flex-col items-center text-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#211F1B', color: '#8C8884' }}>
              <Icons.info size={15} />
            </div>
            <p className="font-syne text-[13px]" style={{ color: '#B0ACA7' }}>Sense resultats a prop</p>
            <p className="font-mono text-[10px]" style={{ color: '#8C8884' }}>Prova amb una altra categoria</p>
          </div>
        )}

        {activeCategory && !isLoading && pois.length > 0 && (
          <>
            <ul>
              {pois.map(item => isEventsMode
                ? <EventRow key={item.id} evt={item} onSelect={handleSelect} onHover={setHovered} isHovered={hoveredId === item.id} />
                : <PoiRow   key={item.id} poi={item} categoryIcon={activeMeta?.icon ?? Icons.pin} onSelect={handleSelect} onHover={setHovered} isHovered={hoveredId === item.id} />
              )}
            </ul>
            <div className="px-4 py-3" style={{ borderTop: '1px solid #2C2926' }}>
              <button
                onClick={() => openChatWithPrompt(
                  `¿Cuál de estas ${activeMeta?.label.toLowerCase() ?? 'lugares'} me recomiendas? Tengo ${pois.length} opciones cerca.`
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
                  <circle cx="8" cy="7.5" r="0.8" fill="currentColor"/>
                  <circle cx="10.5" cy="7.5" r="0.8" fill="currentColor"/>
                </svg>
                Preguntar al asistente
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
