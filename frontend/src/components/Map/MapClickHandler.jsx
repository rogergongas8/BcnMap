import { useEffect, useRef } from 'react'
import { useMapStore } from '../../store/mapStore'
import { usePinStore } from '../../store/pinStore'
import { reverseGeocode } from '../../utils/reverseGeocode'

const INTERACTIVE_LAYER_PATTERNS = [
  /^bicing/,
  /^metro/,
  /^bus/,
  /^route/,
  /^user-location/,
  /^poi/,
  /^beach/,
]

export default function MapClickHandler() {
  const mapInstance = useMapStore(s => s.mapInstance)
  const setPin = usePinStore(s => s.setPin)
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

      setPin({ lat, lng, main: 'Cargando dirección…', sub: '', loading: true })

      const result = await reverseGeocode(lat, lng)
      if (token !== tokenRef.current) return

      setPin({ ...result, loading: false })
    }

    mapInstance.on('click', handler)
    return () => {
      mapInstance.off('click', handler)
    }
  }, [mapInstance, setPin])

  return null
}
