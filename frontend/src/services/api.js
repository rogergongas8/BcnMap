import axios from 'axios'

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL ?? '') + '/api/v1',
  timeout: 10000,
})

export const fetchTraffic    = () => api.get('/traffic').then(r => r.data)
export const fetchBicing     = () => api.get('/bicing').then(r => r.data)
export const fetchBus        = () => api.get('/bus').then(r => r.data)
export const fetchBusArrivals = (stopId) => api.get(`/bus/${stopId}/arrivals`).then(r => r.data)
export const fetchMetro         = () => api.get('/metro').then(r => r.data)
export const fetchMetroLines    = () => api.get('/metro/lines').then(r => r.data)
export const fetchMetroArrivals = (stationId) => api.get(`/metro/${stationId}/arrivals`).then(r => r.data)
export const fetchWeather    = () => api.get('/weather').then(r => r.data)
export const fetchAirQuality = () => api.get('/air-quality').then(r => r.data)
export const sendChat = (message, history, userLocation = null) =>
  api.post('/chat', {
    message,
    conversation_history: history,
    user_lat: userLocation?.lat ?? null,
    user_lng: userLocation?.lng ?? null,
  }).then(r => r.data)

export const fetchRoute = (fromLat, fromLng, toLat, toLng, mode) =>
  api.get('/route', { params: { from_lat: fromLat, from_lng: fromLng, to_lat: toLat, to_lng: toLng, mode } }).then(r => r.data)
