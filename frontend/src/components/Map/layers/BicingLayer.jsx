import { useEffect } from 'react'
import { useMapStore } from '../../../store/mapStore'
import { useDataStore } from '../../../store/dataStore'

const SOURCE_ID = 'bicing-source'
const LAYER_ID  = 'bicing-layer'

function buildGeojson(bicing) {
  return {
    type: 'FeatureCollection',
    features: bicing.map(s => ({
      type: 'Feature',
      properties: {
        name:   s.station_name,
        bikes:  s.bikes_available,
        ebikes: s.ebikes_available,
        docks:  s.docks_available,
        status: s.status,
      },
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    })),
  }
}

export default function BicingLayer({ onHover }) {
  const { mapInstance, isLoaded, styleKey, activeLayers } = useMapStore()
  const bicing = useDataStore(s => s.bicing)
  const visible = activeLayers.includes('bicing')

  useEffect(() => {
    if (!mapInstance || !isLoaded || !bicing.length) return

    try {
      const geojson = buildGeojson(bicing)

      if (mapInstance.getSource(SOURCE_ID)) {
        mapInstance.getSource(SOURCE_ID).setData(geojson)
      } else {
        mapInstance.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
        mapInstance.addLayer({
          id: LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 8],
            'circle-color': [
              'case',
              ['==', ['get', 'status'], 'closed'], '#444444',
              ['==', ['get', 'bikes'], 0],         '#444444',
              ['<=', ['get', 'bikes'], 3],          '#E67E22',
              '#00aaff',
            ],
            'circle-opacity': 0.9,
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(255,255,255,0.2)',
          },
        })

        mapInstance.on('mouseenter', LAYER_ID, (e) => {
          mapInstance.getCanvas().style.cursor = 'pointer'
          onHover?.({ x: e.point.x, y: e.point.y, object: e.features[0]?.properties })
        })
        mapInstance.on('mousemove', LAYER_ID, (e) => {
          onHover?.({ x: e.point.x, y: e.point.y, object: e.features[0]?.properties })
        })
        mapInstance.on('mouseleave', LAYER_ID, () => {
          mapInstance.getCanvas().style.cursor = ''
          onHover?.(null)
        })
      }

      mapInstance.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none')
      mapInstance.triggerRepaint()
    } catch (err) {
      console.error('[BicingLayer]', err)
    }
  }, [mapInstance, isLoaded, styleKey, bicing, visible])

  return null
}
