import { useEffect } from 'react'
import { useMapStore } from '../../../store/mapStore'
import { useDataStore } from '../../../store/dataStore'

const SOURCE_ID        = 'traffic-source'
const SOURCE_POINTS_ID = 'traffic-points-source'
const LAYER_GLOW       = 'traffic-glow'
const LAYER_LINE       = 'traffic-line'
const LAYER_HEATMAP    = 'traffic-heatmap'

const ESTADO_COLOR = [
  'match', ['get', 'estado'],
  'fluido',        '#27AE60',
  'lento',         '#E67E22',
  'congestionado', '#C0392B',
  'cortado',       '#7B241C',
  '#888888',
]

const HEATMAP_WEIGHT = [
  'match', ['get', 'estado'],
  'cortado',       1.0,
  'congestionado', 0.75,
  'lento',         0.35,
  'fluido',        0,
  0,
]

function buildLinesGeojson(traffic) {
  return {
    type: 'FeatureCollection',
    features: traffic.map(t => ({
      type: 'Feature',
      properties: { estado: t.estado, name: t.tramo_name },
      geometry: {
        type: 'LineString',
        coordinates: [[t.lng_start, t.lat_start], [t.lng_end, t.lat_end]],
      },
    })),
  }
}

function buildPointsGeojson(traffic) {
  return {
    type: 'FeatureCollection',
    features: traffic.map(t => ({
      type: 'Feature',
      properties: { estado: t.estado },
      geometry: {
        type: 'Point',
        coordinates: [
          (t.lng_start + t.lng_end) / 2,
          (t.lat_start + t.lat_end) / 2,
        ],
      },
    })),
  }
}

function removeTrafficLayers(map) {
  ;[LAYER_GLOW, LAYER_LINE, LAYER_HEATMAP, 'traffic-layer'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id)
  })
  if (map.getSource(SOURCE_ID))        map.removeSource(SOURCE_ID)
  if (map.getSource(SOURCE_POINTS_ID)) map.removeSource(SOURCE_POINTS_ID)
}

function addFluxLayers(map, traffic, visible) {
  const v = visible ? 'visible' : 'none'
  map.addSource(SOURCE_ID, { type: 'geojson', data: buildLinesGeojson(traffic) })
  map.addLayer({
    id: LAYER_GLOW, type: 'line', source: SOURCE_ID,
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: v },
    paint: {
      'line-color':   ESTADO_COLOR,
      'line-width':   ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 10],
      'line-opacity': 0.06,
      'line-blur':    5,
    },
  })
  map.addLayer({
    id: LAYER_LINE, type: 'line', source: SOURCE_ID,
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: v },
    paint: {
      'line-color':   ESTADO_COLOR,
      'line-width':   ['interpolate', ['linear'], ['zoom'], 12, 1.5, 16, 3],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.45, 16, 0.65],
    },
  })
}

function addHeatmapLayer(map, traffic, visible) {
  map.addSource(SOURCE_POINTS_ID, { type: 'geojson', data: buildPointsGeojson(traffic) })
  map.addLayer({
    id: LAYER_HEATMAP, type: 'heatmap', source: SOURCE_POINTS_ID,
    layout: { visibility: visible ? 'visible' : 'none' },
    paint: {
      'heatmap-weight':    HEATMAP_WEIGHT,
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 15, 1.4],
      'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 11, 20, 15, 40],
      'heatmap-opacity':   0.8,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,   'rgba(0,0,0,0)',
        0.2, 'rgba(255,220,50,0.5)',
        0.5, 'rgba(230,126,34,0.75)',
        0.8, 'rgba(192,57,43,0.9)',
        1.0, 'rgba(123,36,28,1)',
      ],
    },
  })
}

function addIncidentsLayers(map, traffic, visible) {
  const v = visible ? 'visible' : 'none'
  const filter = ['any',
    ['==', ['get', 'estado'], 'cortado'],
    ['==', ['get', 'estado'], 'congestionado'],
  ]
  map.addSource(SOURCE_ID, { type: 'geojson', data: buildLinesGeojson(traffic) })
  map.addLayer({
    id: LAYER_GLOW, type: 'line', source: SOURCE_ID, filter,
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: v },
    paint: {
      'line-color':   ESTADO_COLOR,
      'line-width':   ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 18],
      'line-opacity': 0.15,
      'line-blur':    6,
    },
  })
  map.addLayer({
    id: LAYER_LINE, type: 'line', source: SOURCE_ID, filter,
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: v },
    paint: {
      'line-color':   ESTADO_COLOR,
      'line-width':   ['interpolate', ['linear'], ['zoom'], 12, 2.5, 16, 5],
      'line-opacity': 0.85,
    },
  })
}

function setVisibility(map, visible) {
  const v = visible ? 'visible' : 'none'
  ;[LAYER_GLOW, LAYER_LINE, LAYER_HEATMAP].forEach(id => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v)
  })
}

function updateData(map, traffic, mode) {
  if (mode === 'heatmap') {
    map.getSource(SOURCE_POINTS_ID)?.setData(buildPointsGeojson(traffic))
  } else {
    map.getSource(SOURCE_ID)?.setData(buildLinesGeojson(traffic))
  }
}

export default function TrafficLayer() {
  const { mapInstance, isLoaded, styleKey, activeLayers, trafficMode } = useMapStore()
  const traffic = useDataStore(s => s.traffic)
  const visible = activeLayers.includes('traffic')

  useEffect(() => {
    if (!mapInstance || !isLoaded || !traffic.length) return

    const sourceMissing = trafficMode === 'heatmap'
      ? !mapInstance.getSource(SOURCE_POINTS_ID)
      : !mapInstance.getSource(SOURCE_ID)

    try {
      if (sourceMissing) {
        removeTrafficLayers(mapInstance)
        if (trafficMode === 'flux')           addFluxLayers(mapInstance, traffic, visible)
        else if (trafficMode === 'heatmap')   addHeatmapLayer(mapInstance, traffic, visible)
        else if (trafficMode === 'incidents') addIncidentsLayers(mapInstance, traffic, visible)
      } else {
        updateData(mapInstance, traffic, trafficMode)
        setVisibility(mapInstance, visible)
      }
    } catch (err) {
      console.error('[TrafficLayer]', err)
    }
  }, [mapInstance, isLoaded, styleKey, traffic, trafficMode, visible])

  return null
}
