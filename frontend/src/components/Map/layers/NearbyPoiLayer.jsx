import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapStore } from '../../../store/mapStore'
import { useNearbyStore } from '../../../store/nearbyStore'
import { useDrawerStore } from '../../../store/drawerStore'
import { iconHtml, POI_CATEGORY_COLORS } from '../../UI/icons'

function buildElement(poi, onHover) {
  const el = document.createElement('div')
  el.className = 'bcn-poi'
  el.title = poi.name
  const color = POI_CATEGORY_COLORS[poi.category] ?? 'rgba(255,255,255,0.85)'
  const icon  = iconHtml(poi.category, { size: 13, stroke: color, strokeWidth: 1.8 })
  el.innerHTML = `<span class="bcn-poi-dot">${icon}</span>`
  el.addEventListener('mouseenter', () => onHover(poi.id))
  el.addEventListener('mouseleave', () => onHover(null))
  return el
}

export default function NearbyPoiLayer() {
  const mapInstance = useMapStore(s => s.mapInstance)
  const isLoaded    = useMapStore(s => s.isLoaded)
  const pois        = useNearbyStore(s => s.pois)
  const hoveredId   = useNearbyStore(s => s.hoveredId)
  const setHovered  = useNearbyStore(s => s.setHovered)

  // Use refs for callbacks so markers never need rebuilding when they change
  const openPlaceRef = useRef(useDrawerStore.getState().openPlace)
  const flyToRef     = useRef(useMapStore.getState().flyTo)
  const setHoveredRef = useRef(setHovered)

  useEffect(() => { openPlaceRef.current = useDrawerStore.getState().openPlace })
  useEffect(() => { flyToRef.current = useMapStore.getState().flyTo })
  useEffect(() => { setHoveredRef.current = setHovered }, [setHovered])

  // Map from poi.id → { marker, element }
  const markersRef = useRef(new Map())

  // Rebuild markers only when the POI list changes
  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    const prev    = markersRef.current
    const nextIds = new Set(pois.map(p => p.id))

    // Remove stale markers
    for (const [id, { marker }] of prev) {
      if (!nextIds.has(id)) {
        marker.remove()
        prev.delete(id)
      }
    }

    // Add new markers
    for (const poi of pois) {
      if (prev.has(poi.id)) continue

      const el = buildElement(poi, (id) => setHoveredRef.current(id))

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        flyToRef.current({ lat: poi.lat, lng: poi.lng, zoom: 16 })
        openPlaceRef.current({
          kind: 'poi', id: poi.id, name: poi.name,
          lat: poi.lat, lng: poi.lng,
          address: poi.address, meta: poi,
        })
      })

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([poi.lng, poi.lat])
        .addTo(mapInstance)

      prev.set(poi.id, { marker, element: el })
    }

    // Cleanup only on unmount
    return () => {
      for (const { marker } of markersRef.current.values()) marker.remove()
      markersRef.current = new Map()
    }
  }, [mapInstance, isLoaded, pois]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update hover class directly on DOM — no marker rebuild
  useEffect(() => {
    for (const [id, { element }] of markersRef.current) {
      element.classList.toggle('is-hovered', id === hoveredId)
    }
  }, [hoveredId])

  return null
}
