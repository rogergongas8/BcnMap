import { useEffect, useRef } from 'react'
import { useMapStore } from '../../store/mapStore'
import { useRouteStore } from '../../store/routeStore'
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

      const rs = useRouteStore.getState()
      if (rs.isOpen || rs.dropdownOpen) {
        // If route panel is open, intercept click to update routing points
        const target = rs.picking || 'destination'
        const pt = { lat, lng, label: 'Buscando dirección…' }
        if (target === 'origin') rs.setOrigin(pt)
        else rs.setDestination(pt)
        
        const result = await reverseGeocode(lat, lng)
        if (token !== tokenRef.current) return
        
        const label = result.main || 'Ubicación'
        if (target === 'origin') rs.setOrigin({ lat, lng, label })
        else rs.setDestination({ lat, lng, label })
        return
      }

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
