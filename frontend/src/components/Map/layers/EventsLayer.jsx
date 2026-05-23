import { useEffect } from 'react'
import { useMapStore } from '../../../store/mapStore'
import { useDataStore } from '../../../store/dataStore'

const SOURCE_ID = 'events-source'
const LAYER_HALO = 'events-halo'
const LAYER_DOT  = 'events-dot'
const LAYER_TEXT = 'events-text'

// Color por categoría — sin neones, paleta cálida
const CATEGORY_COLOR = [
  'match', ['get', 'category'],
  'musica',      '#C98E2E',
  'esport',      '#3CB887',
  'cultura',     '#8B6AD4',
  'gastronomia', '#E8622A',
  'familia',     '#4D84D4',
  /* altres */   '#6B6055',
]

const CATEGORY_LABELS = {
  musica:      'Música',
  esport:      'Esport',
  cultura:     'Cultura',
  gastronomia: 'Gastronomia',
  familia:     'Família',
  altres:      'Altres',
}

function buildGeojson(events) {
  const withCoords = events.filter(e => e.lat != null && e.lng != null)
  return {
    type: 'FeatureCollection',
    features: withCoords.map(e => ({
      type: 'Feature',
      properties: {
        title:    e.title,
        category: e.category ?? 'altres',
        place:    e.place ?? '',
        district: e.district ?? '',
        start:    e.start ?? '',
        end:      e.end ?? '',
        today:    e.today ? 1 : 0,
        type:     'event',
      },
      geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
    })),
  }
}

export default function EventsLayer({ onHover, onEventClick }) {
  const { mapInstance, isLoaded, styleKey, activeLayers } = useMapStore()
  const events  = useDataStore(s => s.events)
  const visible = activeLayers.includes('events')

  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    const geojson = buildGeojson(events)

    try {
      if (mapInstance.getSource(SOURCE_ID)) {
        mapInstance.getSource(SOURCE_ID).setData(geojson)
      } else {
        mapInstance.addSource(SOURCE_ID, { type: 'geojson', data: geojson })

        // Halo exterior — anell semitransparent
        mapInstance.addLayer({
          id:   LAYER_HALO,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius':       ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 18],
            'circle-color':        CATEGORY_COLOR,
            'circle-opacity':      0.15,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': CATEGORY_COLOR,
            'circle-stroke-opacity': 0.6,
          },
        })

        // Dot central
        mapInstance.addLayer({
          id:   LAYER_DOT,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius':       ['interpolate', ['linear'], ['zoom'], 10, 3.5, 15, 6],
            'circle-color':        CATEGORY_COLOR,
            'circle-opacity':      0.95,
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(0,0,0,0.3)',
          },
        })

        // Etiqueta de títol visible a zoom alt
        mapInstance.addLayer({
          id:   LAYER_TEXT,
          type: 'symbol',
          source: SOURCE_ID,
          minzoom: 14,
          layout: {
            'text-field': [
              'case',
              ['>', ['length', ['get', 'title']], 22],
              ['concat', ['slice', ['get', 'title'], 0, 22], '…'],
              ['get', 'title'],
            ],
            'text-font':            ['Noto Sans Regular'],
            'text-size':            11,
            'text-offset':          [0, 1.4],
            'text-anchor':          'top',
            'text-max-width':       12,
            'text-allow-overlap':   false,
          },
          paint: {
            'text-color':         '#EDE8DF',
            'text-halo-color':    '#0C0A08',
            'text-halo-width':    1.5,
            'text-opacity':       0.85,
          },
        })

        // Hover
        mapInstance.on('mouseenter', LAYER_HALO, (e) => {
          mapInstance.getCanvas().style.cursor = 'pointer'
          const props = e.features[0]?.properties ?? {}
          onHover?.({ x: e.point.x, y: e.point.y, object: props })
        })
        mapInstance.on('mousemove', LAYER_HALO, (e) => {
          const props = e.features[0]?.properties ?? {}
          onHover?.({ x: e.point.x, y: e.point.y, object: props })
        })
        mapInstance.on('mouseleave', LAYER_HALO, () => {
          mapInstance.getCanvas().style.cursor = ''
          onHover?.(null)
        })

        mapInstance.on('click', LAYER_HALO, (e) => {
          e.preventDefault()
          const props = e.features[0]?.properties ?? {}
          onEventClick?.({ event: props, x: e.point.x, y: e.point.y })
        })
      }

      const v = visible ? 'visible' : 'none'
      mapInstance.setLayoutProperty(LAYER_HALO, 'visibility', v)
      mapInstance.setLayoutProperty(LAYER_DOT,  'visibility', v)
      mapInstance.setLayoutProperty(LAYER_TEXT, 'visibility', v)
    } catch (err) {
      console.error('[EventsLayer]', err)
    }
  }, [mapInstance, isLoaded, styleKey, events, visible])

  return null
}

export { CATEGORY_LABELS }
