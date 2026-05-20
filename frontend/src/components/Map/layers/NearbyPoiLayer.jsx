import { useEffect, useRef } from 'react'
import { useMapStore } from '../../../store/mapStore'
import { useNearbyStore, NEARBY_CATEGORIES } from '../../../store/nearbyStore'
import { useDrawerStore } from '../../../store/drawerStore'
import { POI_CATEGORY_COLORS } from '../../UI/icons'

const SRC     = 'nearby-pois'
const LYR     = 'nearby-pois-circle'
const LYR_HOV = 'nearby-pois-hover'

function toGeoJSON(pois) {
  return {
    type: 'FeatureCollection',
    features: pois.map(poi => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [poi.lng, poi.lat] },
      properties: {
        id:    poi.id,
        color: POI_CATEGORY_COLORS[poi.category] ?? '#ffffff',
        _poi:  JSON.stringify(poi),
      },
    })),
  }
}

export default function NearbyPoiLayer() {
  const mapInstance = useMapStore(s => s.mapInstance)
  const isLoaded    = useMapStore(s => s.isLoaded)
  const styleKey    = useMapStore(s => s.styleKey)
  const pois        = useNearbyStore(s => s.pois)
  const hoveredId   = useNearbyStore(s => s.hoveredId)
  const setHovered  = useNearbyStore(s => s.setHovered)

  const openPlaceRef = useRef(useDrawerStore.getState().openPlace)
  const flyToRef     = useRef(useMapStore.getState().flyTo)
  useEffect(() => { openPlaceRef.current = useDrawerStore.getState().openPlace })
  useEffect(() => { flyToRef.current = useMapStore.getState().flyTo })

  // Build source + layers after map load or style change
  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    const onClick = (e) => {
      if (!e.features?.length) return
      e.preventDefault?.()
      const poi    = JSON.parse(e.features[0].properties._poi)
      const catMeta = NEARBY_CATEGORIES.find(c => c.id === poi.category)
      flyToRef.current({ lat: poi.lat, lng: poi.lng, zoom: 16 })
      openPlaceRef.current({
        kind:     'poi',
        id:       poi.id,
        name:     poi.name,
        lat:      poi.lat,
        lng:      poi.lng,
        address:  poi.address,
        meta:     poi,
        category: catMeta ?? { id: poi.category, label: poi.category },
      })
    }

    const onEnter = (e) => {
      mapInstance.getCanvas().style.cursor = 'pointer'
      setHovered(e.features?.[0]?.properties?.id ?? null)
    }

    const onLeave = () => {
      mapInstance.getCanvas().style.cursor = ''
      setHovered(null)
    }

    try {
      if (!mapInstance.getSource(SRC)) {
        mapInstance.addSource(SRC, { type: 'geojson', data: toGeoJSON([]) })
      }

      if (!mapInstance.getLayer(LYR)) {
        mapInstance.addLayer({
          id: LYR, type: 'circle', source: SRC,
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              11, 4, 14, 7, 17, 10,
            ],
            'circle-color':        ['get', 'color'],
            'circle-opacity':      0.92,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'rgba(10,12,16,0.88)',
          },
        })
        mapInstance.on('click',      LYR, onClick)
        mapInstance.on('mouseenter', LYR, onEnter)
        mapInstance.on('mouseleave', LYR, onLeave)
      }

      if (!mapInstance.getLayer(LYR_HOV)) {
        mapInstance.addLayer({
          id: LYR_HOV, type: 'circle', source: SRC,
          filter: ['==', 1, 0],
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              11, 8, 14, 12, 17, 15,
            ],
            'circle-color':        'rgba(0,0,0,0)',
            'circle-opacity':      1,
            'circle-stroke-width': 2,
            'circle-stroke-color': 'rgba(56,189,248,0.9)',
          },
        })
      }

      mapInstance.getSource(SRC)?.setData(toGeoJSON(pois))
    } catch (err) {
      console.error('[NearbyPoiLayer] setup error:', err)
    }

    return () => {
      try { mapInstance.off('click',      LYR, onClick) } catch (_) {}
      try { mapInstance.off('mouseenter', LYR, onEnter) } catch (_) {}
      try { mapInstance.off('mouseleave', LYR, onLeave) } catch (_) {}
      try { if (mapInstance.getLayer(LYR_HOV)) mapInstance.removeLayer(LYR_HOV) } catch (_) {}
      try { if (mapInstance.getLayer(LYR))     mapInstance.removeLayer(LYR)     } catch (_) {}
      try { if (mapInstance.getSource(SRC))    mapInstance.removeSource(SRC)    } catch (_) {}
    }
  }, [mapInstance, isLoaded, styleKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update GeoJSON when pois change — no layer rebuild, no drift
  useEffect(() => {
    if (!mapInstance || !isLoaded) return
    mapInstance.getSource(SRC)?.setData(toGeoJSON(pois))
  }, [pois, mapInstance, isLoaded])

  // Hover ring: update filter only — zero JS overhead per frame
  useEffect(() => {
    if (!mapInstance || !isLoaded) return
    if (!mapInstance.getLayer(LYR_HOV)) return
    mapInstance.setFilter(LYR_HOV,
      hoveredId != null ? ['==', ['get', 'id'], hoveredId] : ['==', 1, 0]
    )
  }, [hoveredId, mapInstance, isLoaded])

  return null
}
