import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL ?? '') + '/api/v1',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
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
export const sendChat = (message, history, userLocation = null, nearbyPois = []) =>
  api.post('/chat', {
    message,
    conversation_history: history,
    user_lat:    userLocation?.lat ?? null,
    user_lng:    userLocation?.lng ?? null,
    nearby_pois: nearbyPois.slice(0, 12).map(p => ({
      name:       p.name,
      category:   p.category,
      address:    p.address ?? null,
      distance_m: p.distance_m ?? null,
      lat:        p.lat,
      lng:        p.lng,
    })),
  }).then(r => r.data)

export const fetchRoute = (fromLat, fromLng, toLat, toLng, mode) =>
  api.get('/route', { params: { from_lat: fromLat, from_lng: fromLng, to_lat: toLat, to_lng: toLng, mode } }).then(r => r.data)

export const fetchRoutePlan = (fromLat, fromLng, toLat, toLng, constraint = null) =>
  api.get('/route/plan', { params: { from_lat: fromLat, from_lng: fromLng, to_lat: toLat, to_lng: toLng, constraint } }).then(r => r.data)

export const fetchBeaches = () => api.get('/beaches').then(r => r.data)

export const fetchPoisNearby = (lat, lng, radius = 800, categories = []) =>
  api.get('/pois/nearby', {
    params: { lat, lng, radius, categories: categories.join(',') || undefined },
  }).then(r => r.data)

export const fetchPlaceEnrich = (name, lat, lng, category = '') =>
  api.get('/pois/enrich', { params: { name, lat, lng, category } }).then(r => r.data)

export const fetchEventsToday  = () => api.get('/events/today').then(r => r.data)
export const fetchEventsNearby = (lat, lng, radius = 2) =>
  api.get('/events/nearby', { params: { lat, lng, radius } }).then(r => r.data)

export const fetchHistoryTimeline = (hours = 24, step = 5) =>
  api.get('/history/timeline', { params: { hours, step } }).then(r => r.data)

// Auth
export const authRegister = (name, email, password) =>
  api.post('/auth/register', { name, email, password }).then(r => r.data)
export const authLogin = (email, password) =>
  api.post('/auth/login', { email, password }).then(r => r.data)
export const authLogout = () =>
  api.post('/auth/logout').then(r => r.data)
export const authMe = () =>
  api.get('/auth/me').then(r => r.data)

// Favorites
export const fetchFavorites  = () => api.get('/favorites').then(r => r.data)
export const addFavorite     = (data) => api.post('/favorites', data).then(r => r.data)
export const deleteFavorite  = (id) => api.delete(`/favorites/${id}`).then(r => r.data)

// Saved routes
export const fetchSavedRoutes  = () => api.get('/saved-routes').then(r => r.data)
export const addSavedRoute     = (data) => api.post('/saved-routes', data).then(r => r.data)
export const deleteSavedRoute  = (id) => api.delete(`/saved-routes/${id}`).then(r => r.data)
