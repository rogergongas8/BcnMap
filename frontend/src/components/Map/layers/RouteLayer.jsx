import { useEffect, useRef } from 'react'
import { useMapStore } from '../../../store/mapStore'
import { useRouteStore } from '../../../store/routeStore'

const SRC_PREFIX = 'route-seg'
const SRC_ENDPOINTS = 'route-endpoints'
const SRC_WAYPOINTS = 'route-waypoints'
const LYR_ORIGIN_HALO = 'route-origin-halo'
const LYR_ORIGIN_DOT  = 'route-origin-dot'
const LYR_DEST_HALO   = 'route-dest-halo'
const LYR_DEST_PIN    = 'route-dest-pin'
const LYR_WAYPOINT_HALO   = 'route-waypoint-halo'
const LYR_WAYPOINT_OUTER  = 'route-waypoint-outer'
const LYR_WAYPOINT_INNER  = 'route-waypoint-inner'
const LYR_WAYPOINT_LABEL  = 'route-waypoint-label'

function clearSegments(map, segIds) {
  for (const id of [...segIds]) {
    try { map.removeLayer(id + '-glow') } catch (_) {}
    try { map.removeLayer(id + '-line') } catch (_) {}
    try { map.removeSource(id) } catch (_) {}
  }
  segIds.length = 0
}

function clearEndpoints(map) {
  for (const id of [LYR_ORIGIN_HALO, LYR_ORIGIN_DOT, LYR_DEST_HALO, LYR_DEST_PIN]) {
    try { map.removeLayer(id) } catch (_) {}
  }
  try { map.removeSource(SRC_ENDPOINTS) } catch (_) {}
}

function clearWaypoints(map) {
  for (const id of [LYR_WAYPOINT_LABEL, LYR_WAYPOINT_INNER, LYR_WAYPOINT_OUTER, LYR_WAYPOINT_HALO]) {
    try { map.removeLayer(id) } catch (_) {}
  }
  try { map.removeSource(SRC_WAYPOINTS) } catch (_) {}
}

/** Extrae waypoints intermedios (estaciones) de los segmentos. */
function extractWaypoints(segments) {
  const features = []
  const seen = new Set()
  const push = (feat) => {
    const key = `${feat.properties.kind}:${feat.geometry.coordinates.join(',')}`
    if (seen.has(key)) return
    seen.add(key)
    features.push(feat)
  }

  for (const seg of segments) {
    const m = seg.meta ?? {}
    if (seg.type === 'bike') {
      if (m.from_lat != null && m.from_lng != null) {
        push({
          type: 'Feature',
          properties: {
            kind: 'bicing',
            color: '#00ff88',
            label: m.bikes_available != null ? String(m.bikes_available) : '',
          },
          geometry: { type: 'Point', coordinates: [m.from_lng, m.from_lat] },
        })
      }
      if (m.to_lat != null && m.to_lng != null) {
        push({
          type: 'Feature',
          properties: {
            kind: 'bicing',
            color: '#00ff88',
            label: m.docks_available != null ? String(m.docks_available) : '',
          },
          geometry: { type: 'Point', coordinates: [m.to_lng, m.to_lat] },
        })
      }
    } else if (seg.type === 'metro' || seg.type === 'bus') {
      const lineColors = m.line_colors ?? {}
      const lineNames  = Array.isArray(m.lines) ? m.lines : []
      const primary    = lineNames[0]
      const raw        = primary && lineColors[primary] ? lineColors[primary] : (seg.color ?? '#ff6b35')
      const color      = String(raw).startsWith('#') ? raw : '#' + raw

      if (m.from_lat != null && m.from_lng != null) {
        push({
          type: 'Feature',
          properties: { kind: 'metro', color, label: primary ?? '' },
          geometry: { type: 'Point', coordinates: [m.from_lng, m.from_lat] },
        })
      }
      if (m.to_lat != null && m.to_lng != null) {
        push({
          type: 'Feature',
          properties: { kind: 'metro', color, label: primary ?? '' },
          geometry: { type: 'Point', coordinates: [m.to_lng, m.to_lat] },
        })
      }
    }
  }

  return features
}

/** Decide el color real de un segmento (usa el color de la línea de metro si está). */
function segmentColor(seg) {
  if ((seg.type === 'metro' || seg.type === 'bus') && Array.isArray(seg.meta?.lines) && seg.meta.lines.length) {
    // El servicio actual sólo envía nombres de líneas, no colores reales.
    // Si más adelante el backend incluye seg.meta.lineColor lo usamos directamente.
    if (seg.meta.lineColor) {
      const c = String(seg.meta.lineColor)
      return c.startsWith('#') ? c : '#' + c
    }
  }
  return seg.color ?? '#00aaff'
}

export default function RouteLayer() {
  const { mapInstance, isLoaded, styleKey } = useMapStore()
  const { route, origin, destination } = useRouteStore()
  const segIds = useRef([])

  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    clearSegments(mapInstance, segIds.current)
    clearEndpoints(mapInstance)
    clearWaypoints(mapInstance)

    const segments = route?.segments
    if (!segments?.length) return

    // ───────────── Segmentos ─────────────
    for (let i = 0; i < segments.length; i++) {
      const seg   = segments[i]
      if (!seg.geometry?.coordinates?.length) continue

      const srcId = `${SRC_PREFIX}-${i}`
      segIds.current.push(srcId)

      mapInstance.addSource(srcId, {
        type: 'geojson',
        data: { type: 'Feature', geometry: seg.geometry, properties: {} },
      })

      const color   = segmentColor(seg)
      const isWalk  = seg.type === 'walk'
      const isBike  = seg.type === 'bike'
      const isMetro = seg.type === 'metro'
      const isBus   = seg.type === 'bus'
      const isCar   = seg.type === 'drive'

      // ── Glow (halo exterior difuminado) ──
      let glowWidth   = 14
      let glowOpacity = 0.18
      let glowBlur    = 6
      if (isWalk)            { glowWidth = 10; glowOpacity = 0.14; glowBlur = 5 }
      if (isBike)            { glowWidth = 18; glowOpacity = 0.30; glowBlur = 8 }
      if (isMetro || isBus)  { glowWidth = 18; glowOpacity = 0.28; glowBlur = 7 }
      if (isCar)             { glowWidth = 16; glowOpacity = 0.22; glowBlur = 6 }

      mapInstance.addLayer({
        id: srcId + '-glow',
        type: 'line',
        source: srcId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color':   color,
          'line-width':   glowWidth,
          'line-opacity': glowOpacity,
          'line-blur':    glowBlur,
        },
      })

      // ── Línea principal ──
      let width     = 4
      let opacity   = 0.95
      let dasharray = null

      if (isWalk) {
        // Dashed blanca: visual de "andar a pie"
        width     = 3
        opacity   = 0.90
        dasharray = [2, 2.5]
      } else if (isBike) {
        width   = 4.5
        opacity = 0.98
      } else if (isMetro || isBus) {
        // Sólido con el color real de la línea
        width   = 5.5
        opacity = 0.97
      } else if (isCar) {
        width   = 4.5
        opacity = 0.95
      }

      mapInstance.addLayer({
        id: srcId + '-line',
        type: 'line',
        source: srcId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color':   color,
          'line-width':   width,
          'line-opacity': opacity,
          ...(dasharray ? { 'line-dasharray': dasharray } : {}),
        },
      })
    }

    // ───────────── Marcadores origen / destino ─────────────
    const allCoords = segments.flatMap(s => s.geometry?.coordinates ?? [])

    let originCoord = null
    let destCoord   = null
    if (origin)      originCoord = [origin.lng, origin.lat]
    else if (allCoords.length) originCoord = allCoords[0]
    if (destination) destCoord = [destination.lng, destination.lat]
    else if (allCoords.length) destCoord = allCoords[allCoords.length - 1]

    if (originCoord && destCoord) {
      mapInstance.addSource(SRC_ENDPOINTS, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', properties: { kind: 'origin' }, geometry: { type: 'Point', coordinates: originCoord } },
            { type: 'Feature', properties: { kind: 'dest'   }, geometry: { type: 'Point', coordinates: destCoord   } },
          ],
        },
      })

      // Origen — halo azul + punto blanco
      mapInstance.addLayer({
        id: LYR_ORIGIN_HALO,
        type: 'circle',
        source: SRC_ENDPOINTS,
        filter: ['==', ['get', 'kind'], 'origin'],
        paint: {
          'circle-radius':  11,
          'circle-color':   '#00b4ff',
          'circle-opacity': 0.22,
          'circle-blur':    0.4,
        },
      })
      mapInstance.addLayer({
        id: LYR_ORIGIN_DOT,
        type: 'circle',
        source: SRC_ENDPOINTS,
        filter: ['==', ['get', 'kind'], 'origin'],
        paint: {
          'circle-radius':       5,
          'circle-color':        '#ffffff',
          'circle-opacity':      1,
          'circle-stroke-color': '#00b4ff',
          'circle-stroke-width': 2,
        },
      })

      // Destino — pin (halo naranja + círculo grande)
      mapInstance.addLayer({
        id: LYR_DEST_HALO,
        type: 'circle',
        source: SRC_ENDPOINTS,
        filter: ['==', ['get', 'kind'], 'dest'],
        paint: {
          'circle-radius':  16,
          'circle-color':   '#ff6b35',
          'circle-opacity': 0.22,
          'circle-blur':    0.5,
        },
      })
      mapInstance.addLayer({
        id: LYR_DEST_PIN,
        type: 'circle',
        source: SRC_ENDPOINTS,
        filter: ['==', ['get', 'kind'], 'dest'],
        paint: {
          'circle-radius':       7,
          'circle-color':        '#ff6b35',
          'circle-opacity':      1,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
        },
      })
    }

    // ───────────── Waypoints (estaciones intermedias) ─────────────
    const waypointFeatures = extractWaypoints(segments)
    if (waypointFeatures.length) {
      mapInstance.addSource(SRC_WAYPOINTS, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: waypointFeatures },
      })

      // Halo glow exterior
      mapInstance.addLayer({
        id: LYR_WAYPOINT_HALO,
        type: 'circle',
        source: SRC_WAYPOINTS,
        paint: {
          'circle-radius':  12,
          'circle-color':   ['get', 'color'],
          'circle-opacity': 0.20,
          'circle-blur':    0.6,
        },
      })

      // Círculo exterior con color del modo
      mapInstance.addLayer({
        id: LYR_WAYPOINT_OUTER,
        type: 'circle',
        source: SRC_WAYPOINTS,
        paint: {
          'circle-radius':       6.5,
          'circle-color':        ['get', 'color'],
          'circle-opacity':      0.95,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.2,
        },
      })

      // Centro blanco
      mapInstance.addLayer({
        id: LYR_WAYPOINT_INNER,
        type: 'circle',
        source: SRC_WAYPOINTS,
        paint: {
          'circle-radius':  2.5,
          'circle-color':   '#ffffff',
          'circle-opacity': 1,
        },
      })

      // Etiqueta (count bicis / nombre línea) — silent fail si no hay glyphs
      try {
        mapInstance.addLayer({
          id: LYR_WAYPOINT_LABEL,
          type: 'symbol',
          source: SRC_WAYPOINTS,
          layout: {
            'text-field':  ['get', 'label'],
            'text-size':   10,
            'text-offset': [0, -1.8],
            'text-anchor': 'center',
            'text-font':   ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-allow-overlap': true,
          },
          paint: {
            'text-color':       '#ffffff',
            'text-halo-color':  'rgba(0,0,0,0.85)',
            'text-halo-width':  1.4,
            'text-halo-blur':   0.5,
          },
        })
      } catch (_) {
        // El estilo del mapa puede no tener glyphs; ignoramos la capa de texto
      }
    }

    // ───────────── Encuadre ─────────────
    if (allCoords.length > 1) {
      const lngs = allCoords.map(c => c[0])
      const lats = allCoords.map(c => c[1])
      mapInstance.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 120, duration: 1200, maxZoom: 16 }
      )
    }
  }, [mapInstance, isLoaded, styleKey, route, origin, destination])

  return null
}
