const BCN_VIEWBOX = '2.05,41.26,2.33,41.50'

function getCategory(cls, type) {
  if (cls === 'amenity') {
    if (['restaurant', 'cafe', 'bar', 'fast_food', 'pub'].includes(type)) return 'restaurant'
    if (['hospital', 'pharmacy', 'clinic'].includes(type)) return 'health'
    if (['school', 'university', 'college'].includes(type)) return 'education'
    return 'amenity'
  }
  if (cls === 'shop') return 'shop'
  if (cls === 'tourism') return 'tourism'
  if (cls === 'leisure') return 'park'
  if (cls === 'highway') return 'street'
  if (cls === 'railway' || cls === 'public_transport') return 'transit'
  if (cls === 'place') return 'place'
  return 'address'
}

function buildLabel(r) {
  const a = r.address ?? {}
  const mainName = r.namedetails?.name || r.display_name?.split(',')[0]?.trim()
  const parts = [mainName]
  if (a.road && mainName !== a.road) parts.push(a.road)
  const area = a.neighbourhood || a.suburb || a.city_district || a.quarter
  if (area && !parts.some(p => p?.includes(area))) parts.push(area)
  return parts.filter(Boolean).join(', ')
}

export async function geocodeSearch(q, limit = 5) {
  if (!q || q.length < 2) return []
  try {
    const params = new URLSearchParams({
      q, format: 'json', limit: String(limit),
      viewbox: BCN_VIEWBOX, bounded: '1', countrycodes: 'es',
      addressdetails: '1', namedetails: '1',
    })
    const res  = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'ca,es' },
    })
    const data = await res.json()
    return data.map(r => ({
      label:    buildLabel(r),
      lat:      parseFloat(r.lat),
      lng:      parseFloat(r.lon),
      category: getCategory(r.class, r.type),
    }))
  } catch { return [] }
}

export async function geocodeLabel(label) {
  const results = await geocodeSearch(label, 1)
  return results[0] ?? null
}

export async function reverseGeocode(lat, lng) {
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'json', addressdetails: '1' })
    const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { 'Accept-Language': 'ca,es' },
    })
    const data = await res.json()
    const a    = data.address ?? {}
    if (a.road) return a.house_number ? `${a.road}, ${a.house_number}` : a.road
    return data.display_name?.split(',')[0] ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}
