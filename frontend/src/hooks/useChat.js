import { useChatStore } from '../store/chatStore'
import { useMapStore } from '../store/mapStore'
import { useRouteStore } from '../store/routeStore'
import { sendChat } from '../services/api'
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
      const { setOrigin, setDestination, setMode, isOpen, togglePanel } = useRouteStore.getState()
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

      let dest = null
      if (action.dest_lat != null && action.dest_lng != null) {
        dest = { lat: action.dest_lat, lng: action.dest_lng, label: action.dest_label ?? 'Destino' }
      } else if (action.dest_label) {
        dest = await geocodeLabel(action.dest_label + ' Barcelona')
      }

      if (origin) setOrigin(origin)
      if (dest)   setDestination(dest)
      setMode(action.mode === 'bike' ? 'bicing' : (action.mode ?? 'foot'))
      if (!isOpen) togglePanel()

      // Fly the map to destination so user can see it while route calculates
      if (dest) {
        useMapStore.getState().mapInstance?.flyTo({
          center: [dest.lng, dest.lat],
          zoom: 14,
          duration: 1400,
          pitch: 40,
        })
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
      const data = await sendChat(text.trim(), history, userLocation)
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
