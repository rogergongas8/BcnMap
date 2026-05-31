import { useEffect, useRef } from 'react'
import { useMapStore } from '../../../store/mapStore'
import { useDataStore } from '../../../store/dataStore'
import { fetchMetroArrivals } from '../../../services/api'

const SRC_LINES    = 'metro-lines-source'
const SRC_STATIONS = 'metro-stations-source'
const LYR_LINES_GLOW = 'metro-lines-glow'
const LYR_LINES      = 'metro-lines'
const LYR_STA_GLOW   = 'metro-stations-glow'
const LYR_STA        = 'metro-stations'
const LYR_STA_LABEL  = 'metro-stations-label'

const ALL_LAYERS = [LYR_LINES_GLOW, LYR_LINES, LYR_STA_GLOW, LYR_STA, LYR_STA_LABEL]

const toHex = (c) => c ? '#' + String(c).replace(/^#/, '') : '#A855F7'

function buildLinesGeojson(lines) {
  return {
    type: 'FeatureCollection',
    features: lines
      .filter(l => l.geometry?.coordinates?.length)
      .map(l => ({
        type: 'Feature',
        properties: { name: l.name, operator: l.operator ?? '', color: toHex(l.color) },
        geometry: l.geometry,
      })),
  }
}

function buildStationsGeojson(stations) {
  return {
    type: 'FeatureCollection',
    features: stations
      .filter(s => s.lat && s.lng)
      .map(s => ({
        type: 'Feature',
        properties: {
          station_id:   String(s.station_id),
          estacio_id:   s.estacio_id ?? '',
          station_name: s.station_name,
          type:         s.type ?? 'metro',
          lines:        JSON.stringify(s.lines ?? []),
          color:        s.lines?.[0] ? toHex(s.lines[0].color) : '#A855F7',
        },
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      })),
  }
}

export default function MetroLayer({ onHover }) {
  const { mapInstance, isLoaded, styleKey, activeLayers } = useMapStore()
  const metro      = useDataStore(s => s.metro)
  const metroLines = useDataStore(s => s.metroLines)
  const visible    = activeLayers.includes('metro')

  const onHoverRef    = useRef(onHover)
  const activeStation = useRef(null)
  const lastPoint     = useRef({ x: 0, y: 0 })
  // Always-current reference to metro array so event handlers can look up full station data
  const metroRef      = useRef(metro)

  useEffect(() => { onHoverRef.current = onHover }, [onHover])
  useEffect(() => { metroRef.current = metro }, [metro])

  useEffect(() => {
    if (!mapInstance || !isLoaded || !metro.length || !metroLines.length) return

    try {
      const stationsGeojson = buildStationsGeojson(metro)
      const linesGeojson    = buildLinesGeojson(metroLines)

      // ── ESTACIONES (CÍRCULOS) ──
      if (mapInstance.getSource(SRC_STATIONS)) {
        mapInstance.getSource(SRC_STATIONS).setData(stationsGeojson)
        mapInstance.getSource(SRC_STATIONS + '-label').setData(stationsGeojson)
      } else {
        // Usamos dos fuentes separadas con los mismos datos.
        // MapLibre bloquea el renderizado de los círculos si comparten la misma fuente con una capa de símbolos,
        // porque espera a calcular todas las colisiones de texto. Al separarlos, los círculos cargan al instante.
        mapInstance.addSource(SRC_STATIONS, { type: 'geojson', data: stationsGeojson })
        mapInstance.addSource(SRC_STATIONS + '-label', { type: 'geojson', data: stationsGeojson })

        mapInstance.addLayer({
          id: LYR_STA_GLOW,
          type: 'circle',
          source: SRC_STATIONS,
          paint: {
            'circle-radius':  ['interpolate', ['linear'], ['zoom'], 8, 6, 12, 10, 16, 18],
            'circle-color':   ['get', 'color'],
            'circle-opacity': 0.2,
            'circle-blur':    1,
          },
        })

        mapInstance.addLayer({
          id: LYR_STA,
          type: 'circle',
          source: SRC_STATIONS,
          paint: {
            'circle-radius':       ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 5, 14, 6, 16, 9],
            'circle-color':        ['get', 'color'],
            'circle-opacity':      1,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'rgba(255,255,255,0.7)',
          },
        })

        mapInstance.addLayer({
          id: LYR_STA_LABEL,
          type: 'symbol',
          source: SRC_STATIONS + '-label',
          minzoom: 14,
          layout: {
            'text-field':     ['get', 'station_name'],
            'text-font':      ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size':      10,
            'text-offset':    [0, 1.5],
            'text-anchor':    'top',
            'text-max-width': 10,
          },
          paint: {
            'text-color':      ['get', 'color'],
            'text-halo-color': 'rgba(0,0,0,0.9)',
            'text-halo-width': 1.5,
          },
        })

        // Listeners para estaciones (usando LYR_STA)
        const loadArrivals = async (props, point) => {
          const stationId   = String(props.station_id)
          const stationType = props.type ?? 'metro'
          activeStation.current = stationId
          lastPoint.current     = point

          const stationRecord = metroRef.current.find(s => String(s.station_id) === stationId)
          const lines = stationRecord?.lines ?? (() => {
            try { return JSON.parse(props.lines ?? '[]') } catch { return [] }
          })()

          const baseObject = { type: stationType, station_id: stationId, station_name: props.station_name, lines }

          const hasNumericId = /^\d+$/.test(stationId)
          if (!hasNumericId) {
            onHoverRef.current?.({ x: point.x, y: point.y, object: { ...baseObject, trains: [], loading: false } })
            return
          }

          onHoverRef.current?.({ x: point.x, y: point.y, object: { ...baseObject, trains: [], loading: true } })

          try {
            const data = await fetchMetroArrivals(stationId)
            if (activeStation.current === stationId) {
              onHoverRef.current?.({ x: lastPoint.current.x, y: lastPoint.current.y, object: { ...baseObject, trains: data.trains ?? [], loading: false } })
            }
          } catch {
            if (activeStation.current === stationId) {
              onHoverRef.current?.({ x: lastPoint.current.x, y: lastPoint.current.y, object: { ...baseObject, trains: [], loading: false } })
            }
          }
        }

        mapInstance.on('mouseenter', LYR_STA, (e) => {
          mapInstance.getCanvas().style.cursor = 'pointer'
          loadArrivals(e.features[0]?.properties ?? {}, e.point)
        })
        mapInstance.on('mousemove', LYR_STA, (e) => {
          const props = e.features[0]?.properties ?? {}
          lastPoint.current = e.point
          if (activeStation.current !== String(props.station_id)) loadArrivals(props, e.point)
        })
        mapInstance.on('mouseleave', LYR_STA, () => {
          mapInstance.getCanvas().style.cursor = ''
          activeStation.current = null
          onHoverRef.current?.(null)
        })
      }

      // ── LÍNEAS ──
      if (mapInstance.getSource(SRC_LINES)) {
        mapInstance.getSource(SRC_LINES).setData(linesGeojson)
      } else {
        mapInstance.addSource(SRC_LINES, { type: 'geojson', data: linesGeojson })

        mapInstance.addLayer({
          id: LYR_LINES_GLOW,
          type: 'line',
          source: SRC_LINES,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color':   ['get', 'color'],
            'line-width':   ['interpolate', ['linear'], ['zoom'], 10, 8, 16, 14],
            'line-opacity': 0.25,
            'line-blur':    6,
          },
        }, LYR_STA_GLOW)

        mapInstance.addLayer({
          id: LYR_LINES,
          type: 'line',
          source: SRC_LINES,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color':   ['get', 'color'],
            'line-width':   ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 4, 16, 6],
            'line-opacity': 1,
          },
        }, LYR_STA_GLOW)
      }

      // ── VISIBILIDAD ──
      const vis = visible ? 'visible' : 'none'
      ALL_LAYERS.forEach(id => {
        if (mapInstance.getLayer(id)) mapInstance.setLayoutProperty(id, 'visibility', vis)
      })

      mapInstance.triggerRepaint()

    } catch (err) {
      console.error('[MetroLayer]', err)
    }
  }, [mapInstance, isLoaded, styleKey, metro, metroLines, visible])

  return null
}
