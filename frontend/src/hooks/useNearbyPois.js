import { useEffect, useRef } from 'react'
import { useNearbyStore } from '../store/nearbyStore'
import { useMapStore } from '../store/mapStore'
import { fetchPoisNearby } from '../services/api'

const BCN_CENTER = { lat: 41.3851, lng: 2.1734 }

export function useNearbyPois() {
  const isOpen         = useNearbyStore(s => s.isOpen)
  const activeCategory = useNearbyStore(s => s.activeCategory)
  const setPois        = useNearbyStore(s => s.setPois)
  const setLoading     = useNearbyStore(s => s.setLoading)
  const userLocation   = useMapStore(s => s.userLocation)
  const mapInstance    = useMapStore(s => s.mapInstance)
  const tokenRef = useRef(0)

  useEffect(() => {
    if (!isOpen || !activeCategory) { setPois([]); return }

    const token = ++tokenRef.current
    setLoading(true)

    const center = userLocation
      ?? (mapInstance ? { lat: mapInstance.getCenter().lat, lng: mapInstance.getCenter().lng } : BCN_CENTER)

    fetchPoisNearby(center.lat, center.lng, 1200, [activeCategory])
      .then(res => {
        if (token !== tokenRef.current) return
        setPois((res?.data ?? []).slice(0, 30))
      })
      .catch(() => {
        if (token !== tokenRef.current) return
        setPois([])
      })
      .finally(() => {
        if (token !== tokenRef.current) return
        setLoading(false)
      })
  }, [isOpen, activeCategory, userLocation, mapInstance, setPois, setLoading])
}
