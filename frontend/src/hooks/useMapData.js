import { useEffect } from 'react'
import { useDataStore } from '../store/dataStore'
import { useTimeStore } from '../store/timeStore'
import { fetchTraffic, fetchBicing, fetchBus, fetchMetro, fetchMetroLines, fetchWeather, fetchAirQuality, fetchEventsToday, fetchMetroDisruptions } from '../services/api'

const POLL_INTERVAL = 120_000 // 2 min

export function useMapData() {
  const { setTraffic, setBicing, setBus, setMetro, setMetroLines, setEvents, setDisruptions, setWeather, setAirQuality } = useDataStore()

  async function loadAll() {
    if (useTimeStore.getState().isHistorical) return

    const [traffic, bicing, bus, metro, weather, air, disruptions] = await Promise.allSettled([
      fetchTraffic(),
      fetchBicing(),
      fetchBus(),
      fetchMetro(),
      fetchWeather(),
      fetchAirQuality(),
      fetchMetroDisruptions(),
    ])

    if (useTimeStore.getState().isHistorical) return

    if (traffic.status === 'fulfilled')      setTraffic(traffic.value)
    if (bicing.status === 'fulfilled')       setBicing(bicing.value)
    if (bus.status === 'fulfilled')          setBus(bus.value)
    if (metro.status === 'fulfilled')        setMetro(metro.value)
    if (weather.status === 'fulfilled')      setWeather(weather.value)
    if (air.status === 'fulfilled')          setAirQuality(air.value)
    if (disruptions.status === 'fulfilled')  setDisruptions(Array.isArray(disruptions.value) ? disruptions.value : [])
  }

  // Datos estáticos o de baja frecuencia — cargar solo una vez al inicio
  async function loadStatic() {
    try {
      const lines = await fetchMetroLines()
      setMetroLines(lines)
    } catch {}
    try {
      const events = await fetchEventsToday()
      setEvents(Array.isArray(events) ? events : [])
    } catch {}
  }

  useEffect(() => {
    loadAll()
    loadStatic()
    const interval = setInterval(loadAll, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])
}
