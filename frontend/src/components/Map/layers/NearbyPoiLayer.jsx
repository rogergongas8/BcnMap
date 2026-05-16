import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import ReactDOMServer from 'react-dom/server'
import { useMapStore } from '../../../store/mapStore'
import { useNearbyStore, NEARBY_CATEGORIES } from '../../../store/nearbyStore'
import { useDrawerStore } from '../../../store/drawerStore'

const ICON_BY_CATEGORY = Object.fromEntries(NEARBY_CATEGORIES.map(c => [c.id, c.icon]))

function svgString(IconComp) {
  if (!IconComp) return ''
  return ReactDOMServer.renderToStaticMarkup(<IconComp size={13} />)
}

function buildElement(poi, onClick, onHover, isHovered) {
  const el = document.createElement('div')
  el.className = `bcn-poi ${isHovered ? 'is-hovered' : ''}`
  el.title = poi.name

  const Icon = ICON_BY_CATEGORY[poi.category]
  el.innerHTML = `<span class="bcn-poi-dot">${svgString(Icon)}</span>`

  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick(poi)
  })
  el.addEventListener('mouseenter', () => onHover(poi.id))
  el.addEventListener('mouseleave', () => onHover(null))
  return el
}

export default function NearbyPoiLayer() {
  const mapInstance  = useMapStore(s => s.mapInstance)
  const isLoaded     = useMapStore(s => s.isLoaded)
  const pois         = useNearbyStore(s => s.pois)
  const hoveredId    = useNearbyStore(s => s.hoveredId)
  const setHovered   = useNearbyStore(s => s.setHovered)
  const openPlace    = useDrawerStore(s => s.openPlace)
  const flyTo        = useMapStore(s => s.flyTo)

  const markersRef = useRef([])

  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    pois.forEach(poi => {
      const el = buildElement(
        poi,
        (p) => {
          flyTo({ lat: p.lat, lng: p.lng, zoom: 16 })
          openPlace({
            kind: 'poi', id: p.id, name: p.name, lat: p.lat, lng: p.lng,
            address: p.address, meta: p,
          })
        },
        setHovered,
        hoveredId === poi.id,
      )
      const m = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([poi.lng, poi.lat])
        .addTo(mapInstance)
      markersRef.current.push(m)
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
    }
  }, [mapInstance, isLoaded, pois, hoveredId, setHovered, openPlace, flyTo])

  return null
}
