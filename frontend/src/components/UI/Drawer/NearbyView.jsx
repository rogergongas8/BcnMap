import React from 'react'
import { Icons } from '../icons'
import { useNearbyStore, NEARBY_CATEGORIES } from '../../../store/nearbyStore'
import { useDrawerStore } from '../../../store/drawerStore'
import { useMapStore } from '../../../store/mapStore'
import { useNearbyPois } from '../../../hooks/useNearbyPois'

function formatDistance(m) {
  if (m == null) return ''
  if (m < 1000) return `${m} m`
  return `${(m / 1000).toFixed(1)} km`
}

function CategoryRail() {
  const { activeCategory, setCategory } = useNearbyStore()

  return (
    <div className="px-3 py-2.5 border-b border-white/[0.05]">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mb-1">
        {NEARBY_CATEGORIES.map(cat => {
          const Icon   = cat.icon
          const active = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full
                text-[11px] tracking-wide transition-all duration-150 whitespace-nowrap
                ${active
                  ? 'bg-white text-black font-medium'
                  : 'bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]'
                }`}
            >
              <span className={active ? 'text-black' : 'text-white/55'}>
                <Icon size={13} />
              </span>
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
      className={`px-4 py-3 cursor-pointer transition-colors border-b border-white/[0.03]
        ${isHovered ? 'bg-white/[0.04]' : 'hover:bg-white/[0.025]'}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.06] flex items-center justify-center text-white/65 flex-shrink-0">
          <Icon size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-white/95 text-[13px] font-medium leading-tight truncate">
              {poi.name}
            </p>
            {poi.distance_m != null && (
              <span className="text-white/40 text-[10px] tabular-nums flex-shrink-0">
                {formatDistance(poi.distance_m)}
              </span>
            )}
          </div>
          {poi.address && (
            <p className="text-white/45 text-[11px] truncate mt-0.5">{poi.address}</p>
          )}
          {poi.cuisine && (
            <p className="text-white/35 text-[10px] mt-1 capitalize">
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
  const openPlace = useDrawerStore(s => s.openPlace)
  const flyTo     = useMapStore(s => s.flyTo)

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
            <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40">
              <Icons.search size={16} />
            </div>
            <p className="text-white/55 text-[13px] leading-snug max-w-[220px]">
              Selecciona una categoría para descubrir lugares cerca
            </p>
            <p className="text-white/25 text-[11px]">
              {NEARBY_CATEGORIES.length} categorías disponibles
            </p>
          </div>
        )}

        {activeCategory && isLoading && (
          <div className="px-6 py-12 flex flex-col items-center gap-3">
            <div className="flex gap-1.5">
              {[0, 140, 280].map(d => (
                <span key={d} className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
            <p className="text-white/35 text-[11px]">Buscando {activeMeta?.label.toLowerCase()}…</p>
          </div>
        )}

        {activeCategory && !isLoading && pois.length === 0 && (
          <div className="px-6 py-12 flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40">
              <Icons.info size={16} />
            </div>
            <p className="text-white/50 text-[13px]">Sin resultados cerca</p>
            <p className="text-white/30 text-[11px]">Prueba con otra categoría o muévete a otra zona del mapa</p>
          </div>
        )}

        {activeCategory && !isLoading && pois.length > 0 && (
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
        )}
      </div>
    </>
  )
}
