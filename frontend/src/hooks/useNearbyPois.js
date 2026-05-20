import { useEffect, useRef, useCallback } from 'react'
import { useNearbyStore } from '../store/nearbyStore'
import { useMapStore } from '../store/mapStore'
import { fetchPoisNearby } from '../services/api'

const BCN_CENTER = { lat: 41.3851, lng: 2.1734 }
const RADIUS_M   = 2500   // wider search radius
const MAX_POIS   = 60     // more results

export function useNearbyPois() {
  const activeCategory = useNearbyStore(s => s.activeCategory)
  const setPois        = useNearbyStore(s => s.setPois)
  const setLoading     = useNearbyStore(s => s.setLoading)
  const userLocation   = useMapStore(s => s.userLocation)
  const tokenRef       = useRef(0)

  const doFetch = useCallback((center) => {
    const token = ++tokenRef.current
    setLoading(true)

    fetchPoisNearby(center.lat, center.lng, RADIUS_M, [activeCategory])
      .then(res => {
        if (token !== tokenRef.current) return
        setPois((res?.data ?? []).slice(0, MAX_POIS))
      })
      .catch(() => {
        if (token !== tokenRef.current) return
        setPois([])
      })
      .finally(() => {
        if (token !== tokenRef.current) return
        setLoading(false)
      })
  }, [activeCategory, setPois, setLoading])

  // When category is selected, center map on user (or current map center) with flat view
  useEffect(() => {
    if (!activeCategory) return
    const { flyTo, userLocation: loc, mapInstance } = useMapStore.getState()
    const mapCenter = mapInstance?.getCenter()
    const target = loc ?? (mapCenter ? { lat: mapCenter.lat, lng: mapCenter.lng } : BCN_CENTER)
    flyTo({ lat: target.lat, lng: target.lng, zoom: 14, pitch: 0 })
  }, [activeCategory])

  // Fetch when category or user location changes (not on map pan)
  useEffect(() => {
    if (!activeCategory) { setPois([]); return }

    const mapCenter = useMapStore.getState().mapInstance?.getCenter()
    const center = userLocation
      ?? (mapCenter ? { lat: mapCenter.lat, lng: mapCenter.lng } : BCN_CENTER)

    doFetch(center)
  }, [activeCategory, userLocation, doFetch, setPois])

}
