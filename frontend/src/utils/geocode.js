const BCN_VIEWBOX = '2.05,41.26,2.33,41.50'
const BCN_BOUNDS  = { minLat: 41.26, maxLat: 41.50, minLng: 2.05, maxLng: 2.33 }

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

// Returns { main, sub } so the UI can show two distinct lines.
function buildLabelParts(r) {
  const a = r.address ?? {}
  const area = a.neighbourhood || a.suburb || a.city_district || a.quarter || ''

  // Street address with house number: "Carrer de la Pau, 12 · Gràcia"
  if (a.house_number && a.road) {
    return { main: `${a.road}, ${a.house_number}`, sub: area }
  }

  const rawName = r.namedetails?.name || r.display_name?.split(',')[0]?.trim() || ''

  // Named place (restaurant, park, station…): "Parc de la Ciutadella · Sant Pere"
  if (rawName && a.road && rawName !== a.road) {
    return { main: rawName, sub: [a.road, area].filter(Boolean).join(', ') }
  }

  // Street without number: "Carrer de Balmes · Eixample"
  return { main: rawName, sub: area }
}

export async function geocodeSearch(q, limit = 8) {
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

    const seen = new Set()
    return data
      .filter(r => {
        const lat = parseFloat(r.lat)
        const lng = parseFloat(r.lon)
        return lat >= BCN_BOUNDS.minLat && lat <= BCN_BOUNDS.maxLat
            && lng >= BCN_BOUNDS.minLng && lng <= BCN_BOUNDS.maxLng
      })
      .map(r => {
        const { main, sub } = buildLabelParts(r)
        return {
          label:    sub ? `${main} · ${sub}` : main,
          main,
          sub,
          lat:      parseFloat(r.lat),
          lng:      parseFloat(r.lon),
          category: getCategory(r.class, r.type),
        }
      })
      .filter(r => {
        if (seen.has(r.label)) return false
        seen.add(r.label)
        // Deduplicate by normalized name — strips Catalan/Spanish articles so
        // "la Sagrada Família" and "Sagrada Família" collapse into one entry.
        const nameKey = r.main.toLowerCase().trim().replace(/^(la |el |els |les |l'|los |las |the )/i, '')
        if (seen.has(nameKey)) return false
        seen.add(nameKey)
        return true
      })
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
