import { useEffect, useRef } from 'react'
import { useMapStore } from '../../../store/mapStore'

const SRC = 'user-location-src'
const LYR_PULSE = 'user-location-pulse'
const LYR_DOT   = 'user-location-dot'

function buildGeojson(pos) {
  if (!pos) return { type: 'FeatureCollection', features: [] }
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] },
    }],
  }
}

export default function UserLocationLayer() {
  const { mapInstance, isLoaded, styleKey } = useMapStore()
  const watchIdRef = useRef(null)

  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    try {
      const currentLocation = useMapStore.getState().userLocation

      if (!mapInstance.getSource(SRC)) {
        mapInstance.addSource(SRC, { type: 'geojson', data: buildGeojson(currentLocation) })

        mapInstance.addLayer({
          id: LYR_PULSE,
          type: 'circle',
          source: SRC,
          paint: {
            'circle-radius':  14,
            'circle-color':   '#00b4ff',
            'circle-opacity': 0.15,
          },
        })

        mapInstance.addLayer({
          id: LYR_DOT,
          type: 'circle',
          source: SRC,
          paint: {
            'circle-radius':       6,
            'circle-color':        '#00b4ff',
            'circle-opacity':      0.95,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
        })
      } else {
        // Source already exists — just refresh the data with the current location
        mapInstance.getSource(SRC).setData(buildGeojson(currentLocation))
      }
    } catch (err) {
      console.error('[UserLocationLayer]', err)
    }
  }, [mapInstance, isLoaded, styleKey])

  useEffect(() => {
    // FAKE LOCATION FOR DEMO (Plaça Catalunya)
    const demoLocation = { lat: 41.3874, lng: 2.1695 }

    const onSuccess = (pos) => {
      useMapStore.getState().setUserLocation(pos)
      const src = useMapStore.getState().mapInstance?.getSource(SRC)
      src?.setData(buildGeojson(pos))
    }

    // Set it immediately
    onSuccess(demoLocation)

    // Optional: we can simulate movement here later if needed,
    // but a static location is perfect for most demos.

    return () => {
      // Nothing to clean up for fake location
    }
  }, [])

  return null
}
