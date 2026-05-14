import { useEffect, useState } from 'react'
import { useMapStore } from '../../../store/mapStore'
import { fetchAirQuality } from '../../../services/api'

const SOURCE_ID = 'air-quality-overlay'
const LAYER_ID  = 'air-quality-fill'

const BCN_BBOX = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[[2.05, 41.32], [2.30, 41.32], [2.30, 41.48], [2.05, 41.48], [2.05, 41.32]]],
  },
}

const LEVEL_COLOR = {
  good:          '#00ff88',
  moderate:      '#ffcc00',
  unhealthy:     '#ff6600',
  very_unhealthy:'#ff3333',
  hazardous:     '#cc0033',
}

const OVERLAY_OPACITY = {
  unhealthy:      0.08,
  very_unhealthy: 0.15,
  hazardous:      0.25,
}

const MOCK = { aqi: 42, level: 'good', station: 'Eixample' }

export default function AirQualityLayer({ visible }) {
  const { mapInstance, styleKey, isLoaded } = useMapStore()
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetchAirQuality()
        if (!cancelled) setData(res)
      } catch {
        if (!cancelled) setData(MOCK)
      }
    }
    load()
    const interval = setInterval(load, 120_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  useEffect(() => {
    if (!mapInstance || !isLoaded || !mapInstance.isStyleLoaded()) return

    try {
      const needsOverlay = data && OVERLAY_OPACITY[data.level]

      if (!mapInstance.getSource(SOURCE_ID)) {
        mapInstance.addSource(SOURCE_ID, { type: 'geojson', data: BCN_BBOX })
      }

      if (!mapInstance.getLayer(LAYER_ID)) {
        mapInstance.addLayer({
          id:     LAYER_ID,
          type:   'fill',
          source: SOURCE_ID,
          paint:  {
            'fill-color':   LEVEL_COLOR[data?.level] ?? '#ff3333',
            'fill-opacity': needsOverlay ? OVERLAY_OPACITY[data.level] : 0,
          },
        })
      } else if (data) {
        mapInstance.setPaintProperty(LAYER_ID, 'fill-color', LEVEL_COLOR[data.level] ?? '#ff3333')
        mapInstance.setPaintProperty(LAYER_ID, 'fill-opacity',
          visible && needsOverlay ? OVERLAY_OPACITY[data.level] : 0)
      }

      mapInstance.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none')
    } catch (err) {
      console.error('[AirQualityLayer]', err)
    }
  }, [mapInstance, styleKey, isLoaded, data, visible])

  return null
}
