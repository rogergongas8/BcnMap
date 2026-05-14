import { useEffect, useRef } from 'react'
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { useDataStore } from '../store/dataStore'
import { fetchTraffic, fetchBicing, fetchWeather, fetchAirQuality } from '../services/api'

function createEcho() {
  window.Pusher = Pusher
  // Silenciar logs de Pusher en consola
  Pusher.logToConsole = false
  return new Echo({
    broadcaster:       'reverb',
    key:               import.meta.env.VITE_REVERB_APP_KEY,
    wsHost:            import.meta.env.VITE_REVERB_HOST,
    wsPort:            import.meta.env.VITE_REVERB_PORT ?? 8080,
    wssPort:           import.meta.env.VITE_REVERB_PORT ?? 8080,
    forceTLS:          (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
    enabledTransports: ['ws'],
    disableStats:      true,
  })
}

export function useWebSocket() {
  const echoRef = useRef(null)
  const { setTraffic, setBicing, setWeather, setAirQuality } = useDataStore()

  async function refresh() {
    const [traffic, bicing, weather, air] = await Promise.allSettled([
      fetchTraffic(),
      fetchBicing(),
      fetchWeather(),
      fetchAirQuality(),
    ])
    if (traffic.status === 'fulfilled') setTraffic(traffic.value)
    if (bicing.status === 'fulfilled')  setBicing(bicing.value)
    if (weather.status === 'fulfilled') setWeather(weather.value)
    if (air.status === 'fulfilled')     setAirQuality(air.value)
  }

  useEffect(() => {
    // No conectar si Reverb no está configurado
    if (!import.meta.env.VITE_REVERB_APP_KEY || !import.meta.env.VITE_REVERB_HOST) return

    try {
      echoRef.current = createEcho()
      echoRef.current
        .channel('city-data')
        .listen('.data.updated', () => refresh())
    } catch (e) {
      // WebSocket no disponible — el polling de useMapData cubre los updates
    }

    return () => {
      echoRef.current?.leave('city-data')
      echoRef.current?.disconnect()
    }
  }, [])
}
