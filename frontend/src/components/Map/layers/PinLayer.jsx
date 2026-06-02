import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapStore } from '../../../store/mapStore'
import { useDrawerStore } from '../../../store/drawerStore'
import { useRouteStore } from '../../../store/routeStore'

export default function PinLayer() {
  const mapInstance = useMapStore(s => s.mapInstance)
  const place       = useDrawerStore(s => s.place)
  const view        = useDrawerStore(s => s.view)
  const destination = useRouteStore(s => s.destination)
  const route       = useRouteStore(s => s.route)
  const markerRef   = useRef(null)

  useEffect(() => {
    if (!mapInstance) return

    // Show for: any place opened in the drawer (from chat, map click, search) OR pending destination
    const isMapPin      = view === 'place' && place?.lat && place?.lng
    const isPendingDest = destination && !route

    if (!isMapPin && !isPendingDest) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }

    const lat = isMapPin ? place.lat : destination.lat
    const lng = isMapPin ? place.lng : destination.lng

    if (!markerRef.current) {
      const el = document.createElement('div')
      el.className = 'bcn-pin'
      el.innerHTML = '<div class="bcn-pin-pulse"></div><div class="bcn-pin-dot"></div>'
      markerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(mapInstance)
    } else {
      markerRef.current.setLngLat([lng, lat])
    }
  }, [mapInstance, place, view, destination, route])

  useEffect(() => () => {
    if (markerRef.current) markerRef.current.remove()
  }, [])

  return null
}
