import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapStore } from '../../../store/mapStore'
import { useLeisureStore } from '../../../store/leisureStore'
import { useDrawerStore } from '../../../store/drawerStore'
import { useLeisureData } from '../../../hooks/useLeisureData'

const BEACH_SVG = `
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="6" cy="8" r="2.5"/>
  <line x1="6" y1="11" x2="6" y2="20"/>
  <line x1="3" y1="20" x2="21" y2="20"/>
  <path d="M11 18c1.5-1.5 3.5-1.5 5 0M11 14c1.5-1.5 3.5-1.5 5 0"/>
</svg>
`

function buildElement(beach, onClick) {
  const el = document.createElement('div')
  el.className = `bcn-beach bcn-beach-${beach.occupancy_level}`
  el.title = `${beach.name} · ${beach.occupancy_pct}% aforo · ${beach.weather?.temp ?? '—'}°`

  const ring = beach.recommended ? '<span class="bcn-beach-ring"></span>' : ''
  el.innerHTML = `${ring}<span class="bcn-beach-icon">${BEACH_SVG}</span>`

  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick(beach)
  })
  return el
}

export default function BeachLayer() {
  useLeisureData()

  const mapInstance  = useMapStore(s => s.mapInstance)
  const isLoaded     = useMapStore(s => s.isLoaded)
  const showBeaches  = useLeisureStore(s => s.showBeaches)
  const beaches      = useLeisureStore(s => s.beaches)
  const openPlace    = useDrawerStore(s => s.openPlace)
  const flyTo        = useMapStore(s => s.flyTo)

  const markersRef = useRef([])

  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    if (!showBeaches || beaches.length === 0) return

    const handleClick = (beach) => {
      flyTo({ lat: beach.lat, lng: beach.lng, zoom: 15 })
      openPlace({
        kind: 'beach',
        id:   `beach-${beach.id}`,
        name: beach.name,
        lat:  beach.lat,
        lng:  beach.lng,
        meta: beach,
      })
    }

    beaches.forEach(beach => {
      const el = buildElement(beach, handleClick)
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([beach.lng, beach.lat])
        .addTo(mapInstance)
      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
    }
  }, [mapInstance, isLoaded, showBeaches, beaches, openPlace, flyTo])

  return null
}
