import { useEffect, useRef } from 'react'
import { useMapStore } from '../../store/mapStore'
import { useDrawerStore } from '../../store/drawerStore'
import { useContextMenuStore } from '../../store/contextMenuStore'
import { reverseGeocode } from '../../utils/reverseGeocode'

const INTERACTIVE_LAYER_PATTERNS = [
  /^bicing/, /^metro/, /^bus/, /^route/, /^user-location/, /^nearby-pois/, /^events/,
]

export default function MapClickHandler() {
  const mapInstance = useMapStore(s => s.mapInstance)
  const openPlace   = useDrawerStore(s => s.openPlace)
  const tokenRef = useRef(0)

  useEffect(() => {
    if (!mapInstance) return

    const handler = async (e) => {
      const features = mapInstance.queryRenderedFeatures(e.point) ?? []
      const hitsInteractive = features.some(f =>
        INTERACTIVE_LAYER_PATTERNS.some(re => re.test(f.layer?.id ?? ''))
      )
      if (hitsInteractive) return

      const { lng, lat } = e.lngLat
      const token = ++tokenRef.current

      openPlace({
        kind: 'pin',
        id:   `pin-${lat.toFixed(5)}-${lng.toFixed(5)}`,
        name: 'Buscando dirección…',
        lat, lng,
        loading: true,
      })

      const result = await reverseGeocode(lat, lng)
      if (token !== tokenRef.current) return

      openPlace({
        kind:    'pin',
        id:      `pin-${lat.toFixed(5)}-${lng.toFixed(5)}`,
        name:    result.main || 'Ubicación',
        address: result.sub || null,
        lat, lng,
        loading: false,
      })
    }

    mapInstance.on('click', handler)
    
    const contextHandler = (e) => {
      e.preventDefault()
      const { lng, lat } = e.lngLat
      const { x, y } = e.point
      useContextMenuStore.getState().openMenu(x, y, lng, lat)
    }
    mapInstance.on('contextmenu', contextHandler)

    return () => { 
      mapInstance.off('click', handler)
      mapInstance.off('contextmenu', contextHandler)
    }
  }, [mapInstance, openPlace])

  return null
}
