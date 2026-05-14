import { useEffect } from 'react'
import { useMapStore } from '../store/mapStore'
import { useRouteStore } from '../store/routeStore'
import { fetchRoute } from '../services/api'
import { reverseGeocode } from '../utils/geocode'

export function useRoute() {
  const { mapInstance } = useMapStore()
  const {
    picking, setPicking,
    setOrigin, setDestination,
    origin, destination, mode,
    setRoute, setLoading, setError,
  } = useRouteStore()

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

  useEffect(() => {
    if (!origin || !destination) return

    const calculate = async () => {
      setLoading(true)
      try {
        const result = await fetchRoute(origin.lat, origin.lng, destination.lat, destination.lng, mode)
        if (result.error) setError(result.error)
        else setRoute(result)
      } catch {
        setError('No se pudo calcular la ruta')
      } finally {
        setLoading(false)
      }
    }

    calculate()
  }, [origin, destination, mode])
}
