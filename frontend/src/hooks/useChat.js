import { useChatStore } from '../store/chatStore'
import { useMapStore } from '../store/mapStore'
import { useNearbyStore } from '../store/nearbyStore'
import { useRouteStore } from '../store/routeStore'
import { sendChat, fetchRoute } from '../services/api'
import { geocodeLabel } from '../utils/geocode'

const BCN_HOME = { lat: 41.3851, lng: 2.1734, zoom: 13 }

async function executeMapActions(actions) {
  if (!Array.isArray(actions)) return
  const { flyTo } = useMapStore.getState()

  for (const action of actions) {
    if (action.type === 'fly_to') {
      flyTo({ lat: action.lat, lng: action.lng, zoom: action.zoom ?? 15 })

    } else if (action.type === 'reset_view') {
      flyTo(BCN_HOME)

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
      addMessage('assistant', data.reply ?? 'Sin respuesta')
      await executeMapActions(data.map_actions)
    } catch {
      addMessage('assistant', 'Error conectando con el servidor. Comprueba que el backend está activo.')
    } finally {
      setLoading(false)
    }
  }

  return { messages, isLoading, sendMessage }
}
