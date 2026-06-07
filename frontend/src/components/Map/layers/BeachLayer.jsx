import { useEffect, useRef } from 'react'
import { useMapStore } from '../../../store/mapStore'
import { useLeisureStore } from '../../../store/leisureStore'
import { useDrawerStore } from '../../../store/drawerStore'
import { useLeisureData } from '../../../hooks/useLeisureData'

const SRC = 'beach-source'
const LYR_RING = 'beach-ring'
const LYR_DOT = 'beach-dot'
const LYR_ICON = 'beach-icon'
const LYR_TEXT = 'beach-text'

// Añadimos xmlns y stroke="white" para poder usarlo como imagen nativa
const BEACH_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <circle cx="6" cy="8" r="2.5"/>
  <line x1="6" y1="11" x2="6" y2="20"/>
  <line x1="3" y1="20" x2="21" y2="20"/>
  <path d="M11 18c1.5-1.5 3.5-1.5 5 0M11 14c1.5-1.5 3.5-1.5 5 0"/>
</svg>`

function buildGeojson(beaches) {
  return {
    type: 'FeatureCollection',
    features: beaches.filter(b => b.lat && b.lng).map(b => ({
      type: 'Feature',
      properties: {
        id: b.id,
        name: b.name,
        occupancy_level: b.occupancy_level,
        recommended: b.recommended ? 1 : 0,
        _beach: JSON.stringify(b),
      },
      geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
    })),
  }
}

export default function BeachLayer() {
  useLeisureData()

  const mapInstance = useMapStore(s => s.mapInstance)
  const isLoaded    = useMapStore(s => s.isLoaded)
  const showBeaches = useLeisureStore(s => s.showBeaches)
  const beaches     = useLeisureStore(s => s.beaches)
  const styleKey    = useMapStore(s => s.styleKey)

  const openPlaceRef = useRef(useDrawerStore.getState().openPlace)
  const flyToRef     = useRef(useMapStore.getState().flyTo)

  useEffect(() => { openPlaceRef.current = useDrawerStore.getState().openPlace })
  useEffect(() => { flyToRef.current = useMapStore.getState().flyTo })

  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    const onClick = (e) => {
      if (!e.features?.length) return
      e.preventDefault()
      const beach = JSON.parse(e.features[0].properties._beach)
      flyToRef.current({ lat: beach.lat, lng: beach.lng, zoom: 15 })
      openPlaceRef.current({
        kind: 'beach',
        id:   `beach-${beach.id}`,
        name: beach.name,
        lat:  beach.lat,
        lng:  beach.lng,
        meta: beach,
      })
    }

    const onEnter = () => { mapInstance.getCanvas().style.cursor = 'pointer' }
    const onLeave = () => { mapInstance.getCanvas().style.cursor = '' }

    try {
      if (!mapInstance.hasImage('beach-icon-img')) {
        const img = new Image()
        img.onload = () => {
          if (!mapInstance.hasImage('beach-icon-img')) {
            mapInstance.addImage('beach-icon-img', img)
          }
        }
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(BEACH_SVG)
      }

      if (!mapInstance.getSource(SRC)) {
        mapInstance.addSource(SRC, { type: 'geojson', data: buildGeojson([]) })
      }

      const colorExpr = [
        'match', ['get', 'occupancy_level'],
        'low',    '#34d399',
        'medium', '#fbbf24',
        'high',   '#f43f5e',
        '#34d399' // fallback
      ]

      if (!mapInstance.getLayer(LYR_RING)) {
        mapInstance.addLayer({
          id: LYR_RING, type: 'circle', source: SRC,
          filter: ['==', ['get', 'recommended'], 1],
          paint: {
            'circle-radius': 17,
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-width': 2,
            'circle-stroke-color': colorExpr,
            'circle-stroke-opacity': 0.6,
          }
        })
      }

      if (!mapInstance.getLayer(LYR_DOT)) {
        mapInstance.addLayer({
          id: LYR_DOT, type: 'circle', source: SRC,
          paint: {
            'circle-radius': 12,
            'circle-color': colorExpr,
            'circle-opacity': 0.95,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'rgba(10,12,16,0.9)',
          }
        })
      }

      if (!mapInstance.getLayer(LYR_ICON)) {
        mapInstance.addLayer({
          id: LYR_ICON, type: 'symbol', source: SRC,
          layout: {
            'icon-image': 'beach-icon-img',
            'icon-allow-overlap': true,
          }
        })
      }

      if (!mapInstance.getLayer(LYR_TEXT)) {
        mapInstance.addLayer({
          id: LYR_TEXT, type: 'symbol', source: SRC,
          minzoom: 12.5,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 11,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
          },
          paint: {
            'text-color': '#fff',
            'text-halo-color': '#0a0c10',
            'text-halo-width': 1.5,
          }
        })
      }

      mapInstance.on('click', LYR_DOT, onClick)
      mapInstance.on('click', LYR_ICON, onClick)
      mapInstance.on('mouseenter', LYR_DOT, onEnter)
      mapInstance.on('mouseleave', LYR_DOT, onLeave)

    } catch (e) {
      console.error('[BeachLayer]', e)
    }

    return () => {
      try { mapInstance.off('click', LYR_DOT, onClick) } catch(e){}
      try { mapInstance.off('click', LYR_ICON, onClick) } catch(e){}
      try { mapInstance.off('mouseenter', LYR_DOT, onEnter) } catch(e){}
      try { mapInstance.off('mouseleave', LYR_DOT, onLeave) } catch(e){}
      
      try { if (mapInstance.getLayer(LYR_TEXT)) mapInstance.removeLayer(LYR_TEXT) } catch(e){}
      try { if (mapInstance.getLayer(LYR_ICON)) mapInstance.removeLayer(LYR_ICON) } catch(e){}
      try { if (mapInstance.getLayer(LYR_DOT))  mapInstance.removeLayer(LYR_DOT)  } catch(e){}
      try { if (mapInstance.getLayer(LYR_RING)) mapInstance.removeLayer(LYR_RING) } catch(e){}
      try { if (mapInstance.getSource(SRC))     mapInstance.removeSource(SRC)     } catch(e){}
    }
  }, [mapInstance, isLoaded, styleKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapInstance || !isLoaded) return
    const source = mapInstance.getSource(SRC)
    if (!source) return
    
    if (!showBeaches) {
      source.setData(buildGeojson([]))
    } else {
      source.setData(buildGeojson(beaches))
    }
  }, [mapInstance, isLoaded, beaches, showBeaches])

  return null
}
