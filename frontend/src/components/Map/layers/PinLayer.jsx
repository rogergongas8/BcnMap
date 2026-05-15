import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapStore } from '../../../store/mapStore'
import { usePinStore } from '../../../store/pinStore'

export default function PinLayer() {
  const mapInstance = useMapStore(s => s.mapInstance)
  const pin = usePinStore(s => s.pin)
  const markerRef = useRef(null)

  useEffect(() => {
    if (!mapInstance) return
    if (!pin) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }

    if (!markerRef.current) {
      const el = document.createElement('div')
      el.className = 'bcn-pin'
      el.innerHTML = `
        <div class="bcn-pin-pulse"></div>
        <div class="bcn-pin-dot"></div>
      `
      markerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([pin.lng, pin.lat])
        .addTo(mapInstance)
    } else {
      markerRef.current.setLngLat([pin.lng, pin.lat])
    }
  }, [mapInstance, pin])

  useEffect(() => () => {
    if (markerRef.current) markerRef.current.remove()
  }, [])

  return null
}
