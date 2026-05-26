import { useEffect } from 'react'
import { useRouteStore } from '../store/routeStore'
import { useMapStore } from '../store/mapStore'
import { useDrawerStore } from '../store/drawerStore'
import { NEARBY_CATEGORIES } from '../store/nearbyStore'

// Reads URL params on first load and rehydrates state:
//   ?from=lat,lng&to=lat,lng&mode=X&fl=label&tl=label  → route
//   ?place=lat,lng&name=xxx&cat=yyy                     → open PlaceView

export function useDeepLink() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    // ── Place deep link ──────────────────────────────────────────────────────
    const placeRaw = params.get('place')
    if (placeRaw) {
      const [lat, lng] = placeRaw.split(',').map(Number)
      if (lat && lng) {
        const name = params.get('name') ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        const catId = params.get('cat') ?? ''
        const category = NEARBY_CATEGORIES.find(c => c.id === catId) ?? null

        useMapStore.getState().flyTo({ lat, lng, zoom: 16 })

        // Slight delay so the map settles before the drawer opens
        setTimeout(() => {
          useDrawerStore.getState().openPlace({
            kind:     'poi',
            id:       `deeplink-${lat}-${lng}`,
            name,
            lat,
            lng,
            address:  null,
            meta:     {},
            category,
          })
        }, 800)

        const clean = window.location.pathname + window.location.hash
        window.history.replaceState(null, '', clean)
        return
      }
    }

    // ── Route deep link ──────────────────────────────────────────────────────
    const fromRaw = params.get('from')
    const toRaw   = params.get('to')
    if (!fromRaw || !toRaw) return

    const [fLat, fLng] = fromRaw.split(',').map(Number)
    const [tLat, tLng] = toRaw.split(',').map(Number)
    if (!fLat || !fLng || !tLat || !tLng) return

    const mode   = params.get('mode') ?? 'foot'
    const fLabel = params.get('fl') ?? `${fLat.toFixed(4)}, ${fLng.toFixed(4)}`
    const tLabel = params.get('tl') ?? `${tLat.toFixed(4)}, ${tLng.toFixed(4)}`

    useMapStore.getState().flyTo({ lat: tLat, lng: tLng, zoom: 14 })

    useRouteStore.getState().setChatRequest({
      origin:      { lat: fLat, lng: fLng, label: fLabel },
      destination: { lat: tLat, lng: tLng, label: tLabel },
      mode,
    })

    const clean = window.location.pathname + window.location.hash
    window.history.replaceState(null, '', clean)
  }, [])
}

// Builds a shareable URL for a place
export function sharePlaceUrl(name, lat, lng, cat = '') {
  const base = `${window.location.origin}${window.location.pathname}`
  const p = new URLSearchParams()
  p.set('place', `${lat.toFixed(6)},${lng.toFixed(6)}`)
  if (name) p.set('name', name)
  if (cat)  p.set('cat', cat)
  return `${base}?${p.toString()}`
}
