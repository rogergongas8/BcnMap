const BCN_BOUNDS = { minLat: 41.26, maxLat: 41.50, minLng: 2.05, maxLng: 2.33 }

function buildLabel(r) {
  const a = r.address ?? {}
  const area = a.neighbourhood || a.suburb || a.city_district || a.quarter || a.borough || ''

  if (a.house_number && a.road) {
    return { main: `${a.road}, ${a.house_number}`, sub: area }
  }
  if (a.road) {
    return { main: a.road, sub: area }
  }
  if (r.name) {
    return { main: r.name, sub: area }
  }
  const first = r.display_name?.split(',')[0]?.trim() ?? 'Ubicación'
  return { main: first, sub: area }
}

export async function reverseGeocode(lat, lng) {
  if (lat < BCN_BOUNDS.minLat || lat > BCN_BOUNDS.maxLat || lng < BCN_BOUNDS.minLng || lng > BCN_BOUNDS.maxLng) {
    return { main: 'Fuera de Barcelona', sub: '', lat, lng }
  }

  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
      addressdetails: '1',
      zoom: '18',
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { 'Accept-Language': 'ca,es' },
    })
    if (!res.ok) throw new Error('reverse-geocode failed')
    const data = await res.json()
    const { main, sub } = buildLabel(data)
    return { main, sub, lat, lng, raw: data }
  } catch {
    return { main: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, sub: '', lat, lng }
  }
}
