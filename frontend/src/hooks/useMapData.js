import { useEffect } from 'react'
import { useDataStore } from '../store/dataStore'
import { fetchTraffic, fetchBicing, fetchBus, fetchMetro, fetchMetroLines, fetchWeather, fetchAirQuality } from '../services/api'

const POLL_INTERVAL = 120_000 // 2 min

export function useMapData() {
  const { setTraffic, setBicing, setBus, setMetro, setMetroLines, setWeather, setAirQuality } = useDataStore()

  async function loadAll() {
    const [traffic, bicing, bus, metro, weather, air] = await Promise.allSettled([
      fetchTraffic(),
      fetchBicing(),
      fetchBus(),
      fetchMetro(),
      fetchWeather(),
      fetchAirQuality(),
    ])

    if (traffic.status === 'fulfilled')  setTraffic(traffic.value)
    if (bicing.status === 'fulfilled')   setBicing(bicing.value)
    if (bus.status === 'fulfilled')      setBus(bus.value)
    if (metro.status === 'fulfilled')    setMetro(metro.value)
    if (weather.status === 'fulfilled')  setWeather(weather.value)
    if (air.status === 'fulfilled')      setAirQuality(air.value)
  }

  // Las líneas de metro son datos estáticos — cargar solo una vez
  async function loadMetroLines() {
    try {
      const lines = await fetchMetroLines()
      setMetroLines(lines)
    } catch {}
  }

  useEffect(() => {
    loadAll()
    loadMetroLines()
    const interval = setInterval(loadAll, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])
}
