import { useEffect } from 'react'
import { useMapStore } from '../../../store/mapStore'
import { useRouteStore } from '../../../store/routeStore'

const SRC_PREFIX  = 'route-seg'
const addedIds = []

function clearRouteLayers(map) {
  for (const id of [...addedIds]) {
    try { map.removeLayer(id + '-glow') } catch (_) {}
    try { map.removeLayer(id + '-line') } catch (_) {}
    try { map.removeSource(id) } catch (_) {}
  }
  addedIds.length = 0
}

export default function RouteLayer() {
  const { mapInstance, isLoaded, styleKey } = useMapStore()
  const { route } = useRouteStore()

  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    clearRouteLayers(mapInstance)

    const segments = route?.segments
    if (!segments?.length) return

    for (let i = 0; i < segments.length; i++) {
      const seg   = segments[i]
      const srcId = `${SRC_PREFIX}-${i}`
      addedIds.push(srcId)

      mapInstance.addSource(srcId, {
        type: 'geojson',
        data: { type: 'Feature', geometry: seg.geometry, properties: {} },
      })

      const color    = seg.color ?? '#00aaff'
      const isDashed = seg.type === 'walk'
      const isTransit = seg.type === 'metro' || seg.type === 'bus'

      mapInstance.addLayer({
        id: srcId + '-glow', type: 'line', source: srcId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': color, 'line-width': isDashed ? 8 : 14, 'line-opacity': 0.14, 'line-blur': 6 },
      })

      mapInstance.addLayer({
        id: srcId + '-line', type: 'line', source: srcId,
        layout: { 'line-cap': isDashed ? 'butt' : 'round', 'line-join': 'round' },
        paint: {
          'line-color':   color,
          'line-width':   isDashed ? 2.5 : (isTransit ? 4 : 3.5),
          'line-opacity': isDashed ? 0.6 : 0.95,
          ...(isDashed   ? { 'line-dasharray': [4, 4] } : {}),
          ...(isTransit  ? { 'line-dasharray': [8, 4] } : {}),
        },
      })
    }

    const allCoords = segments.flatMap(s => s.geometry?.coordinates ?? [])
    if (allCoords.length > 1) {
      const lngs = allCoords.map(c => c[0])
      const lats  = allCoords.map(c => c[1])
      mapInstance.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 100, duration: 1200, maxZoom: 16 }
      )
    }
  }, [mapInstance, isLoaded, styleKey, route])

  return null
}
