import { useEffect, useRef } from 'react'
import { useDataStore } from '../store/dataStore'
import { useTimeStore } from '../store/timeStore'
import { useLangStore } from '../store/langStore'
import {
  fetchTraffic, fetchBicing, fetchBus, fetchMetro, fetchMetroLines,
  fetchWeather, fetchWeatherForecast, fetchAirQuality, fetchEventsToday, fetchMetroDisruptions,
} from '../services/api'

const POLL_INTERVAL = 120_000

export function useMapData() {
  const { setTraffic, setBicing, setBus, setMetro, setMetroLines, setEvents, setDisruptions, setWeather, setForecast, setAirQuality } = useDataStore()
  const lang = useLangStore(s => s.lang)
  const mounted = useRef(true)

  async function loadAll() {
    if (useTimeStore.getState().isHistorical) return
    const currentLang = useLangStore.getState().lang

    const [traffic, bicing, bus, metro, weather, air, disruptions] = await Promise.allSettled([
      fetchTraffic(),
      fetchBicing(),
      fetchBus(),
      fetchMetro(),
      fetchWeather(currentLang),
      fetchAirQuality(),
      fetchMetroDisruptions(),
    ])

    if (useTimeStore.getState().isHistorical || !mounted.current) return

    if (traffic.status === 'fulfilled')      setTraffic(traffic.value)
    if (bicing.status === 'fulfilled')       setBicing(bicing.value)
    if (bus.status === 'fulfilled')          setBus(bus.value)
    if (metro.status === 'fulfilled')        setMetro(metro.value)
    if (weather.status === 'fulfilled')      setWeather(weather.value)
    if (air.status === 'fulfilled')          setAirQuality(air.value)
    if (disruptions.status === 'fulfilled')  setDisruptions(Array.isArray(disruptions.value) ? disruptions.value : [])
  }

  async function loadForecast() {
    const currentLang = useLangStore.getState().lang
    try {
      const data = await fetchWeatherForecast(currentLang)
      if (data && mounted.current) setForecast(data)
    } catch {}
  }

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
    mounted.current = true
    loadAll()
    loadStatic()
    loadForecast()
    const interval = setInterval(loadAll, POLL_INTERVAL)
    return () => {
      mounted.current = false
      clearInterval(interval)
    }
  }, [])

  // Re-fetch weather + forecast when language changes
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    const currentLang = lang
    fetchWeather(currentLang).then(data => { if (data && mounted.current) setWeather(data) }).catch(() => {})
    loadForecast()
  }, [lang])
}
