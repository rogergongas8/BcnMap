import { useEffect } from 'react'
import { useRouteStore } from '../store/routeStore'
import { useMapStore } from '../store/mapStore'

// Reads ?from=lat,lng&to=lat,lng&mode=X&fl=label&tl=label on first load
// and rehydrates the route search via chatRequest.
export function useDeepLink() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromRaw = params.get('from')
    const toRaw   = params.get('to')
    if (!fromRaw || !toRaw) return

    const [fLat, fLng] = fromRaw.split(',').map(Number)
    const [tLat, tLng] = toRaw.split(',').map(Number)
    if (!fLat || !fLng || !tLat || !tLng) return

    const mode  = params.get('mode') ?? 'foot'
    const fLabel = params.get('fl') ?? `${fLat.toFixed(4)}, ${fLng.toFixed(4)}`
    const tLabel = params.get('tl') ?? `${tLat.toFixed(4)}, ${tLng.toFixed(4)}`

    // Center map on destination
    useMapStore.getState().flyTo({ lat: tLat, lng: tLng, zoom: 14 })

    // Trigger SearchBar via chatRequest pattern
    useRouteStore.getState().setChatRequest({
      origin:      { lat: fLat, lng: fLng, label: fLabel },
      destination: { lat: tLat, lng: tLng, label: tLabel },
      mode,
    })

    // Clean URL without reloading
    const clean = window.location.pathname + window.location.hash
    window.history.replaceState(null, '', clean)
  }, [])
}
