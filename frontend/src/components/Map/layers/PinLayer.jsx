import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapStore } from '../../../store/mapStore'
import { useDrawerStore } from '../../../store/drawerStore'

export default function PinLayer() {
  const mapInstance = useMapStore(s => s.mapInstance)
  const place       = useDrawerStore(s => s.place)
  const view        = useDrawerStore(s => s.view)
  const markerRef   = useRef(null)

  useEffect(() => {
    if (!mapInstance) return

    const visible = view === 'place' && place && place.kind === 'pin'

    if (!visible) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }

    if (!markerRef.current) {
      const el = document.createElement('div')
      el.className = 'bcn-pin'
      el.innerHTML = '<div class="bcn-pin-pulse"></div><div class="bcn-pin-dot"></div>'
      markerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([place.lng, place.lat])
        .addTo(mapInstance)
    } else {
      markerRef.current.setLngLat([place.lng, place.lat])
    }
  }, [mapInstance, place, view])

  useEffect(() => () => {
    if (markerRef.current) markerRef.current.remove()
  }, [])

  return null
}
