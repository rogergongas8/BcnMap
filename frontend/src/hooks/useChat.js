import { useChatStore } from '../store/chatStore'
import { useMapStore } from '../store/mapStore'
import { useNearbyStore } from '../store/nearbyStore'
import { useRouteStore } from '../store/routeStore'
import { useDrawerStore } from '../store/drawerStore'
import { sendChat, fetchRoute, fetchRoutePlan } from '../services/api'
import { geocodeLabel } from '../utils/geocode'

const BCN_HOME = { lat: 41.3851, lng: 2.1734, zoom: 13 }

async function executeMapActions(actions) {
  if (!Array.isArray(actions)) return
  const { flyTo } = useMapStore.getState()
  const { suppressMapMove, clearSuppressMapMove } = useChatStore.getState()
  if (suppressMapMove) clearSuppressMapMove()

  for (const action of actions) {
    // Skip camera-only actions when called from an info context (event/POI card "Preguntar")
    if (suppressMapMove && (action.type === 'fly_to' || action.type === 'open_place')) continue

    if (action.type === 'fly_to') {
      flyTo({ lat: action.lat, lng: action.lng, zoom: action.zoom ?? 15 })

    } else if (action.type === 'reset_view') {
      flyTo(BCN_HOME)

    } else if (action.type === 'open_place') {
      const pois = useNearbyStore.getState().pois
      const nearby = pois.find(p =>
        (action.lat != null && action.lng != null &&
          Math.abs(p.lat - action.lat) < 0.0008 && Math.abs(p.lng - action.lng) < 0.0008) ||
        p.name === action.name
      )
      const target = nearby ?? (action.lat != null ? { lat: action.lat, lng: action.lng, name: action.name } : null)
      if (!target) continue
      flyTo({ lat: target.lat, lng: target.lng, zoom: 17 })
      if (nearby) {
        useDrawerStore.getState().openPlace({
          kind:     'poi',
          id:       nearby.id,
          name:     nearby.name,
          lat:      nearby.lat,
          lng:      nearby.lng,
          address:  nearby.address,
          meta:     nearby,
          category: action.category ? { label: action.category } : null,
        })
      }

    } else if (action.type === 'plan_trip') {
      const userLoc = useMapStore.getState().userLocation

      let origin = null
      if (action.origin_lat != null && action.origin_lng != null) {
        origin = { lat: action.origin_lat, lng: action.origin_lng, label: action.origin_label ?? 'Mi ubicación' }
      } else if (userLoc) {
        origin = { ...userLoc, label: 'Mi ubicación' }
      } else if (action.origin_label) {
        origin = await geocodeLabel(action.origin_label + ' Barcelona')
      }

      let dest = null
      if (action.dest_lat != null && action.dest_lng != null) {
        dest = { lat: action.dest_lat, lng: action.dest_lng, label: action.dest_label ?? 'Destino' }
      } else if (action.dest_label) {
        dest = await geocodeLabel(action.dest_label + ' Barcelona')
      }

      if (!origin || !dest) continue

      useMapStore.getState().flyTo({ lat: dest.lat, lng: dest.lng, zoom: 14 })

      try {
        const plan = await fetchRoutePlan(origin.lat, origin.lng, dest.lat, dest.lng, action.constraint ?? null)
        const { setOrigin, setDestination, setMode, setChatRequest } = useRouteStore.getState()
        setOrigin(origin)
        setDestination(dest)
        setMode(plan.recommended ?? 'foot')
        setChatRequest({ origin, destination: dest, mode: plan.recommended ?? 'foot', plan })
      } catch {
        const { setOrigin, setDestination, setMode, setChatRequest } = useRouteStore.getState()
        setOrigin(origin)
        setDestination(dest)
        setMode('foot')
        setChatRequest({ origin, destination: dest, mode: 'foot', route: null })
      }

    } else if (action.type === 'show_events') {
      useDrawerStore.getState().openEvents({ category: action.category ?? null })

    } else if (action.type === 'calculate_route') {
      const userLoc = useMapStore.getState().userLocation

      let origin = null
      if (action.origin_lat != null && action.origin_lng != null) {
        origin = { lat: action.origin_lat, lng: action.origin_lng, label: action.origin_label ?? 'Origen' }
      } else if (action.origin_label) {
        const isMyLocation = /ubicaci[oó]n|posici[oó]n|aqu[ií]|mi\s+loc/i.test(action.origin_label)
        origin = isMyLocation && userLoc
          ? { ...userLoc, label: 'Mi ubicación' }
          : await geocodeLabel(action.origin_label + ' Barcelona')
      }
      // Fallback to GPS location
      if (!origin && userLoc) origin = { ...userLoc, label: 'Mi ubicación' }

      let dest = null
      if (action.dest_lat != null && action.dest_lng != null) {
        dest = { lat: action.dest_lat, lng: action.dest_lng, label: action.dest_label ?? 'Destino' }
      } else if (action.dest_label) {
        dest = await geocodeLabel(action.dest_label + ' Barcelona')
      }

      if (!origin || !dest) return

      const mode = action.mode === 'bike' ? 'bicing' : (action.mode ?? 'foot')

      // Fly to destination immediately
      useMapStore.getState().flyTo({ lat: dest.lat, lng: dest.lng, zoom: 14 })

      // Fetch the route then signal SearchBar to open with the data
      try {
        const route = await fetchRoute(origin.lat, origin.lng, dest.lat, dest.lng, mode)
        const { setOrigin, setDestination, setMode, setRoute, setChatRequest } = useRouteStore.getState()
        setMode(mode)
        setOrigin(origin)
        setDestination(dest)
        if (!route.error) setRoute(route)
        setChatRequest({ origin, destination: dest, mode, route: route.error ? null : route })
      } catch {
        // Best-effort: open SearchBar without a route so user can still interact
        const { setOrigin, setDestination, setMode, setChatRequest } = useRouteStore.getState()
        setMode(mode)
        setOrigin(origin)
        setDestination(dest)
        setChatRequest({ origin, destination: dest, mode, route: null })
      }
    }
  }
}

export function useChat() {
  const { messages, isLoading, addMessage, setLoading } = useChatStore()

  async function sendMessage(text) {
    if (!text.trim() || isLoading) return

    addMessage('user', text.trim())
    setLoading(true)

    try {
      const history     = useChatStore.getState().messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.text,
      }))
      const userLocation = useMapStore.getState().userLocation
      const nearbyPois   = useNearbyStore.getState().pois
      const data = await sendChat(text.trim(), history, userLocation, nearbyPois)
      const suggestions = Array.isArray(data.suggestions) && data.suggestions.length > 0
        ? data.suggestions
        : undefined
      addMessage('assistant', data.reply ?? 'Sin respuesta', suggestions ? { suggestions } : {})
      await executeMapActions(data.map_actions)
    } catch {
      addMessage('assistant', 'Error conectando con el servidor. Comprueba que el backend está activo.')
    } finally {
      setLoading(false)
    }
  }

  async function executeSuggestionAction(suggestion) {
    if (suggestion.action === 'open_place') {
      await executeMapActions([
        { type: 'fly_to', lat: suggestion.lat, lng: suggestion.lng, zoom: 16 },
        { type: 'open_place', name: suggestion.name, lat: suggestion.lat, lng: suggestion.lng, category: suggestion.category ?? null },
      ])
    } else if (suggestion.action === 'route') {
      await executeMapActions([
        { type: 'plan_trip', origin_lat: null, origin_lng: null, origin_label: null, dest_lat: suggestion.lat, dest_lng: suggestion.lng, dest_label: suggestion.name, constraint: null },
      ])
    }
  }

  return { messages, isLoading, sendMessage, executeSuggestionAction }
}
