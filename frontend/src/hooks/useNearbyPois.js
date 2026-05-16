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
  const mapInstance    = useMapStore(s => s.mapInstance)
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

  // Fetch when category or user location changes
  useEffect(() => {
    if (!activeCategory) { setPois([]); return }

    const center = userLocation
      ?? (mapInstance ? { lat: mapInstance.getCenter().lat, lng: mapInstance.getCenter().lng } : BCN_CENTER)

    doFetch(center)
  }, [activeCategory, userLocation, mapInstance, doFetch, setPois])

  // Re-fetch when the map is panned/zoomed (debounced 600ms) — only if no user GPS
  useEffect(() => {
    if (!activeCategory || !mapInstance || userLocation) return

    let timer = null

    const onMoveEnd = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const c = mapInstance.getCenter()
        doFetch({ lat: c.lat, lng: c.lng })
      }, 600)
    }

    mapInstance.on('moveend', onMoveEnd)
    return () => {
      mapInstance.off('moveend', onMoveEnd)
      clearTimeout(timer)
    }
  }, [activeCategory, mapInstance, userLocation, doFetch])
}
