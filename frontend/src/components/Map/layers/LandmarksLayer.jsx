import { useEffect } from 'react'
import { useMapStore } from '../../../store/mapStore'

const SOURCE_ID = 'landmarks'
const LAYER_CIRCLES = 'landmarks-circles'
const LAYER_LABELS  = 'landmarks-labels'

const LANDMARKS = [
  { id: 'sagrada-familia', name: 'Sagrada Família',    lat: 41.4036, lng: 2.1744 },
  { id: 'casa-batllo',     name: 'Casa Batlló',        lat: 41.3917, lng: 2.1649 },
  { id: 'casa-mila',       name: 'La Pedrera',         lat: 41.3954, lng: 2.1619 },
  { id: 'park-guell',      name: 'Park Güell',         lat: 41.4145, lng: 2.1527 },
  { id: 'camp-nou',        name: 'Camp Nou',            lat: 41.3809, lng: 2.1228 },
  { id: 'barceloneta',     name: 'Barceloneta',         lat: 41.3809, lng: 2.1897 },
  { id: 'boqueria',        name: 'La Boqueria',         lat: 41.3817, lng: 2.1718 },
  { id: 'ciutadella',      name: 'Parc Ciutadella',     lat: 41.3868, lng: 2.1869 },
  { id: 'montjuic',        name: 'Montjuïc',            lat: 41.3641, lng: 2.1528 },
  { id: 'tibidabo',        name: 'Tibidabo',            lat: 41.4219, lng: 2.1188 },
  { id: 'arc-triomf',      name: 'Arc de Triomf',       lat: 41.3910, lng: 2.1805 },
  { id: 'palau-musica',    name: 'Palau de la Música',  lat: 41.3875, lng: 2.1752 },
  { id: 'macba',           name: 'MACBA',               lat: 41.3826, lng: 2.1665 },
  { id: 'ramblas',         name: 'La Rambla',           lat: 41.3797, lng: 2.1738 },
]

const GEOJSON = {
  type: 'FeatureCollection',
  features: LANDMARKS.map(l => ({
    type: 'Feature',
    properties: { name: l.name },
    geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
  })),
}

export default function LandmarksLayer({ visible }) {
  const { mapInstance, styleKey } = useMapStore()

  useEffect(() => {
    if (!mapInstance || !mapInstance.isStyleLoaded()) return

    if (!mapInstance.getSource(SOURCE_ID)) {
      mapInstance.addSource(SOURCE_ID, { type: 'geojson', data: GEOJSON })
    }

    if (!mapInstance.getLayer(LAYER_CIRCLES)) {
      mapInstance.addLayer({
        id:     LAYER_CIRCLES,
        type:   'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius':       6,
          'circle-color':        'rgba(0, 180, 255, 0.9)',
          'circle-stroke-color': 'rgba(255, 255, 255, 0.9)',
          'circle-stroke-width': 1.5,
        },
      })
    }

    if (!mapInstance.getLayer(LAYER_LABELS)) {
      mapInstance.addLayer({
        id:     LAYER_LABELS,
        type:   'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field':  ['get', 'name'],
          'text-font':   ['Noto Sans Regular'],
          'text-size':   11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
        },
        paint: {
          'text-color':       '#0a0a14',
          'text-halo-color':  'rgba(255,255,255,0.9)',
          'text-halo-width':  1.5,
        },
      })
    }

    const v = visible ? 'visible' : 'none'
    mapInstance.setLayoutProperty(LAYER_CIRCLES, 'visibility', v)
    mapInstance.setLayoutProperty(LAYER_LABELS,  'visibility', v)
    mapInstance.triggerRepaint()
  }, [mapInstance, styleKey, visible])

  return null
}
