import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/mapStore'
import { useRouteStore } from '../store/routeStore'

const ADVANCE_M  = 30   // advance step when within 30m of the next waypoint
const OFFROUTE_M = 150  // warn when >150m from the route line

function haversineM(lat1, lng1, lat2, lng2) {
  const R  = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Minimum distance from a point to a polyline segment
function distToSegmentM(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dx = bLng - aLng
  const dy = bLat - aLat
  if (dx === 0 && dy === 0) return haversineM(pLat, pLng, aLat, aLng)
  const t = Math.max(0, Math.min(1, ((pLng - aLng) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy)))
  return haversineM(pLat, pLng, aLat + t * dy, aLng + t * dx)
}

function distToPolylineM(lat, lng, coords) {
  let minDist = Infinity
  for (let i = 0; i < coords.length - 1; i++) {
    const [aLng, aLat] = coords[i]
    const [bLng, bLat] = coords[i + 1]
    const d = distToSegmentM(lat, lng, aLat, aLng, bLat, bLng)
    if (d < minDist) minDist = d
  }
  return minDist
}

export function useNavigation() {
  const userLocation    = useMapStore(s => s.userLocation)
  const { isNavigating, route, currentStepIndex, advanceStep } = useRouteStore()
  const lastAdvance = useRef(-1)

  useEffect(() => {
    if (!isNavigating || !userLocation || !route) return

    const seg   = route.segments?.[0]
    const steps = seg?.steps
    if (!steps?.length) return

    const coords = seg.geometry?.coordinates
    if (!coords?.length) return

    const { lat, lng } = userLocation
    const nextStep = steps[currentStepIndex + 1]

    // Advance step when approaching the next maneuver waypoint
    if (nextStep && lastAdvance.current !== currentStepIndex) {
      const wp = coords[nextStep.shape_index]
      if (wp) {
        const dist = haversineM(lat, lng, wp[1], wp[0])
        if (dist < ADVANCE_M) {
          lastAdvance.current = currentStepIndex
          advanceStep()
        }
      }
    }

    // Off-route detection (stored in store for HUD to read)
    const offRoute = distToPolylineM(lat, lng, coords) > OFFROUTE_M
    useRouteStore.setState({ offRoute })
  }, [userLocation, isNavigating, currentStepIndex])
}
