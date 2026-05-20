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
    <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #262626' }}>
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
                border: `1px solid ${active ? '#E8622A' : '#262626'}`,
                background: active ? '#E8622A' : '#1C1C1C',
                color: active ? '#fff' : '#888',
              }}
            >
              <span style={{ color: active ? '#fff' : '#555' }}><Icon size={12} /></span>
              <span>{cat.label}</span>
            </button>
          )
        })}
      </div>
    </div>
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
        borderBottom: '1px solid #1A1A1A',
        background: isHovered ? '#1C1C1C' : 'transparent',
      }}
    >
      {/* Accent bar */}
      <div className="w-[3px] flex-shrink-0 self-stretch" style={{ background: isHovered ? '#E8622A' : 'transparent', transition: 'background 0.15s' }} />

      <div className="flex items-start gap-3 px-3.5 py-3 flex-1 min-w-0">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: '#262626', color: '#888' }}
        >
          <Icon size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-syne text-[13px] font-medium leading-tight truncate" style={{ color: '#EBEBEB' }}>
              {poi.name}
            </p>
            {poi.distance_m != null && (
              <span className="font-mono text-[10px] flex-shrink-0 tabular-nums" style={{ color: '#555' }}>
                {formatDistance(poi.distance_m)}
              </span>
            )}
          </div>
          {poi.address && (
            <p className="font-mono text-[10px] truncate mt-0.5" style={{ color: '#555' }}>{poi.address}</p>
          )}
          {poi.cuisine && (
            <p className="font-mono text-[10px] mt-0.5 capitalize" style={{ color: '#555' }}>
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

  const handleSelect = (poi) => {
    flyTo({ lat: poi.lat, lng: poi.lng, zoom: 16 })
    openPlace({
      kind:    'poi',
      id:      poi.id,
      name:    poi.name,
      lat:     poi.lat,
      lng:     poi.lng,
      address: poi.address,
      meta:    poi,
      category: activeMeta,
    })
  }

  return (
    <>
      <CategoryRail />

      <div className="flex-1 overflow-y-auto min-h-0">
        {!activeCategory && (
          <div className="px-6 py-12 flex flex-col items-center text-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#1C1C1C', color: '#555' }}>
              <Icons.search size={15} />
            </div>
            <p className="font-syne text-[13px] leading-snug max-w-[200px]" style={{ color: '#888' }}>
              Selecciona una categoría per descobrir llocs a prop
            </p>
            <p className="font-mono text-[10px]" style={{ color: '#555' }}>
              {NEARBY_CATEGORIES.length} categories disponibles
            </p>
          </div>
        )}

        {activeCategory && isLoading && (
          <div className="px-6 py-12 flex flex-col items-center gap-3">
            <div className="flex gap-1.5">
              {[0, 140, 280].map(d => (
                <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#E8622A', animationDelay: `${d}ms` }} />
              ))}
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: '#555' }}>
              Cercant {activeMeta?.label.toLowerCase()}…
            </p>
          </div>
        )}

        {activeCategory && !isLoading && pois.length === 0 && (
          <div className="px-6 py-12 flex flex-col items-center text-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#1C1C1C', color: '#555' }}>
              <Icons.info size={15} />
            </div>
            <p className="font-syne text-[13px]" style={{ color: '#888' }}>Sense resultats a prop</p>
            <p className="font-mono text-[10px]" style={{ color: '#555' }}>Prova amb una altra categoria</p>
          </div>
        )}

        {activeCategory && !isLoading && pois.length > 0 && (
          <>
            <ul>
              {pois.map(poi => (
                <PoiRow
                  key={poi.id}
                  poi={poi}
                  categoryIcon={activeMeta?.icon ?? Icons.pin}
                  onSelect={handleSelect}
                  onHover={setHovered}
                  isHovered={hoveredId === poi.id}
                />
              ))}
            </ul>
            <div className="px-4 py-3" style={{ borderTop: '1px solid #262626' }}>
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
                  border: '1px solid #262626',
                  background: '#1C1C1C',
                  color: '#888',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8622A'; e.currentTarget.style.color = '#E8622A' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#262626'; e.currentTarget.style.color = '#888' }}
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
