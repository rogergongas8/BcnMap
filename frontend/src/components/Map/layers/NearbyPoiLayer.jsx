import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapStore } from '../../../store/mapStore'
import { useNearbyStore, NEARBY_CATEGORIES } from '../../../store/nearbyStore'

const EMOJI_BY_CATEGORY = Object.fromEntries(NEARBY_CATEGORIES.map(c => [c.id, c.emoji]))

function buildElement(poi, onClick) {
  const el = document.createElement('div')
  el.className = 'bcn-poi'
  el.title = poi.name

  const icon = EMOJI_BY_CATEGORY[poi.category] ?? '•'
  el.innerHTML = `<div class="bcn-poi-dot">${icon}</div>`

  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick(poi)
  })
  return el
}

export default function NearbyPoiLayer() {
  const mapInstance  = useMapStore(s => s.mapInstance)
  const isLoaded     = useMapStore(s => s.isLoaded)
  const pois         = useNearbyStore(s => s.pois)
  const selectedPoi  = useNearbyStore(s => s.selectedPoi)
  const selectPoi    = useNearbyStore(s => s.selectPoi)
  const flyTo        = useMapStore(s => s.flyTo)

  const markersRef = useRef([])

  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    pois.forEach(poi => {
      const el = buildElement(poi, (p) => {
        selectPoi(p)
        flyTo({ lat: p.lat, lng: p.lng, zoom: 16 })
      })
      if (selectedPoi?.id === poi.id) {
        el.style.zIndex = '20'
        el.querySelector('.bcn-poi-dot').style.borderColor = 'rgba(34, 211, 238, 0.8)'
        el.querySelector('.bcn-poi-dot').style.boxShadow = '0 0 16px rgba(34, 211, 238, 0.6)'
      }
      const m = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([poi.lng, poi.lat])
        .addTo(mapInstance)
      markersRef.current.push(m)
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
    }
  }, [mapInstance, isLoaded, pois, selectedPoi, selectPoi, flyTo])

  return null
}
