import { useEffect, useRef } from 'react'
import { useMapStore } from '../../../store/mapStore'
import { useDataStore } from '../../../store/dataStore'
import { fetchBusArrivals } from '../../../services/api'

const SOURCE_ID = 'bus-source'
const LAYER_ID  = 'bus-layer'

function buildGeojson(stops) {
  return {
    type: 'FeatureCollection',
    features: stops.map(s => ({
      type: 'Feature',
      properties: {
        stop_id:   s.stop_id,
        stop_name: s.stop_name,
        address:   s.address,
      },
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    })),
  }
}

export default function BusLayer({ onHover }) {
  const { mapInstance, isLoaded, styleKey, activeLayers } = useMapStore()
  const bus     = useDataStore(s => s.bus)
  const visible = activeLayers.includes('bus')

  // Ref para que los listeners del mapa siempre usen el onHover más reciente
  const onHoverRef = useRef(onHover)
  useEffect(() => { onHoverRef.current = onHover }, [onHover])

  const activeStop = useRef(null)
  const lastPoint  = useRef({ x: 0, y: 0 })

  // Registrar layers y listeners una sola vez cuando el mapa carga
  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    try {
      // Si la source ya existe, solo actualizar datos
      if (mapInstance.getSource(SOURCE_ID)) {
        mapInstance.getSource(SOURCE_ID).setData(buildGeojson(bus))
        return
      }

      mapInstance.addSource(SOURCE_ID, { type: 'geojson', data: buildGeojson(bus) })

      mapInstance.addLayer({
        id: LAYER_ID + '-glow',
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius':  ['interpolate', ['linear'], ['zoom'], 12, 7, 16, 14],
          'circle-color':   '#FF6B35',
          'circle-opacity': 0.15,
          'circle-blur':    1,
        },
      })

      mapInstance.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius':       ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 8],
          'circle-color':        '#FF6B35',
          'circle-opacity':      0.95,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.4)',
        },
      })

      mapInstance.addLayer({
        id: LAYER_ID + '-label',
        type: 'symbol',
        source: SOURCE_ID,
        minzoom: 15,
        layout: {
          'text-field':     ['get', 'stop_name'],
          'text-font':      ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size':      10,
          'text-offset':    [0, 1.4],
          'text-anchor':    'top',
          'text-max-width': 8,
        },
        paint: {
          'text-color':      '#FF6B35',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.5,
        },
      })

      const emit = (x, y, buses, props, loading) => {
        onHoverRef.current?.({
          x, y,
          object: {
            stop_id:   props.stop_id,
            stop_name: props.stop_name,
            address:   props.address,
            type:      'bus',
            buses,
            loading,
          },
        })
      }

      const loadArrivals = async (props, point) => {
        const stopId = props.stop_id
        activeStop.current = stopId
        lastPoint.current  = point

        emit(point.x, point.y, [], props, true)

        try {
          const data = await fetchBusArrivals(stopId)
          if (activeStop.current === stopId) {
            emit(lastPoint.current.x, lastPoint.current.y, data.buses ?? [], props, false)
          }
        } catch {
          if (activeStop.current === stopId) {
            emit(lastPoint.current.x, lastPoint.current.y, [], props, false)
          }
        }
      }

      mapInstance.on('mouseenter', LAYER_ID, (e) => {
        mapInstance.getCanvas().style.cursor = 'pointer'
        loadArrivals(e.features[0]?.properties ?? {}, e.point)
      })

      mapInstance.on('mousemove', LAYER_ID, (e) => {
        const props  = e.features[0]?.properties ?? {}
        lastPoint.current = e.point
        if (activeStop.current !== props.stop_id) {
          loadArrivals(props, e.point)
        }
      })

      mapInstance.on('mouseleave', LAYER_ID, () => {
        mapInstance.getCanvas().style.cursor = ''
        activeStop.current = null
        onHoverRef.current?.(null)
      })

    } catch (err) {
      console.error('[BusLayer]', err)
    }
  }, [mapInstance, isLoaded, styleKey])  // styleKey fuerza re-registro tras cambio de tema

  // Actualizar datos del GeoJSON cuando cambian las paradas
  useEffect(() => {
    if (!mapInstance || !isLoaded) return
    if (mapInstance.getSource(SOURCE_ID)) {
      mapInstance.getSource(SOURCE_ID).setData(buildGeojson(bus))
    }
  }, [bus])

  // Visibilidad
  useEffect(() => {
    if (!mapInstance || !isLoaded) return
    const vis = visible ? 'visible' : 'none'
    ;[LAYER_ID, LAYER_ID + '-glow', LAYER_ID + '-label'].forEach(id => {
      if (mapInstance.getLayer(id)) mapInstance.setLayoutProperty(id, 'visibility', vis)
    })
    if (visible) {
      setTimeout(() => {
        const source = mapInstance.getSource(SOURCE_ID)
        if (source) source.setData(buildGeojson(useDataStore.getState().bus))
      }, 50)
    }
    mapInstance.triggerRepaint()
  }, [visible, mapInstance, isLoaded])

  return null
}
