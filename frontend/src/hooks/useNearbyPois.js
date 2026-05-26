import { useEffect, useRef, useCallback } from 'react'
import { useNearbyStore } from '../store/nearbyStore'
import { useMapStore } from '../store/mapStore'
import { fetchPoisNearby, fetchEventsNearby } from '../services/api'

const BCN_CENTER = { lat: 41.3851, lng: 2.1734 }
const RADIUS_M   = 2500
const MAX_POIS   = 60

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function useNearbyPois() {
  const activeCategory = useNearbyStore(s => s.activeCategory)
  const setPois        = useNearbyStore(s => s.setPois)
  const setLoading     = useNearbyStore(s => s.setLoading)
  const userLocation   = useMapStore(s => s.userLocation)
  const tokenRef       = useRef(0)

  const doFetch = useCallback((center) => {
    const token = ++tokenRef.current
    setLoading(true)

    const isEvents = activeCategory === 'events'
    const promise = isEvents
      ? fetchEventsNearby(center.lat, center.lng, 3).then(res => {
          const list = (Array.isArray(res) ? res : res?.data ?? [])
            .filter(e => e.lat && e.lng)
            .map(e => ({
              ...e,
              distance_m: Math.round(haversineM(center.lat, center.lng, e.lat, e.lng)),
            }))
            .sort((a, b) => a.distance_m - b.distance_m)
            .slice(0, MAX_POIS)
          return list
        })
      : fetchPoisNearby(center.lat, center.lng, RADIUS_M, [activeCategory])
          .then(res => (res?.data ?? []).slice(0, MAX_POIS))

    promise
      .then(list => { if (token !== tokenRef.current) return; setPois(list) })
      .catch(() => { if (token !== tokenRef.current) return; setPois([]) })
      .finally(() => { if (token !== tokenRef.current) return; setLoading(false) })
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
