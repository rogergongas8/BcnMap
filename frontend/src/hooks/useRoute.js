import { useEffect } from 'react'
import { useMapStore } from '../store/mapStore'
import { useRouteStore } from '../store/routeStore'
import { reverseGeocode } from '../utils/geocode'

// Handles only map-click picking mode. Route fetching is owned by SearchBar
// (which reuses preview data to avoid duplicate OSRM calls).
export function useRoute() {
  const { mapInstance } = useMapStore()
  const { picking, setPicking, setOrigin, setDestination } = useRouteStore()

  useEffect(() => {
    if (!mapInstance || !picking) return

    const canvas = mapInstance.getCanvas()
    canvas.style.cursor = 'crosshair'

    const handler = async (e) => {
      const { lat, lng } = e.lngLat
      const label = await reverseGeocode(lat, lng)
      if (picking === 'origin') {
        setOrigin({ lat, lng, label })
        setPicking('destination')
      } else {
        setDestination({ lat, lng, label })
        setPicking(null)
      }
    }

    mapInstance.on('click', handler)
    return () => {
      mapInstance.off('click', handler)
      canvas.style.cursor = ''
    }
  }, [mapInstance, picking])
}
