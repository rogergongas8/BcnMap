import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapStore } from '../../../store/mapStore'
import { useLeisureStore } from '../../../store/leisureStore'
import { useLeisureData } from '../../../hooks/useLeisureData'

function buildMarkerElement(beach, onClick) {
  const el = document.createElement('div')
  el.className = 'bcn-beach'
  el.title = `${beach.name} · ${beach.occupancy_level} · ${beach.weather?.temp ?? '—'}°C`

  const recommended = beach.recommended ? '<div class="bcn-beach-ring"></div>' : ''
  const icon = beach.flag === 'red' ? '⚠' : beach.is_beach_day ? '☀' : '🌊'

  el.innerHTML = `${recommended}<div class="bcn-beach-dot bcn-beach-${beach.occupancy_level}">${icon}</div>`

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
  const selectBeach  = useLeisureStore(s => s.selectBeach)

  const markersRef = useRef([])

  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    if (!showBeaches || beaches.length === 0) return

    beaches.forEach(beach => {
      const el = buildMarkerElement(beach, selectBeach)
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([beach.lng, beach.lat])
        .addTo(mapInstance)
      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
    }
  }, [mapInstance, isLoaded, showBeaches, beaches, selectBeach])

  return null
}
