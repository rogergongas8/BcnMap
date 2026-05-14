import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMapStore } from '../../store/mapStore'

const BCN = { center: [2.1734, 41.3950], zoom: 14, pitch: 0, bearing: 0 }

export const MAP_THEMES = {
  voyager: {
    url:             'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    buildings:       true,
    buildingColor:   ['#a8a49c', '#949088', '#807c74', '#6c6860'],
    buildingOpacity: 1.0,
  },
  dark: {
    url:             'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    buildings:       true,
    buildingColor:   ['#545458', '#424246', '#303034', '#1e1e22'],
    buildingOpacity: 1.0,
  },
  minimal: {
    url:             'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    buildings:       false,
    buildingOpacity: 0,
  },
}

export default function MapContainer() {
  const containerRef  = useRef(null)
  const mapRef        = useRef(null)
  const styleReadyRef = useRef(false)
  const { setMapInstance, setLoaded, bumpStyleKey, mapTheme, showBuildings3D, isLoaded } = useMapStore()

  // ── Inicialización ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return
    const theme = MAP_THEMES[mapTheme] ?? MAP_THEMES.voyager

    const map = new maplibregl.Map({
      container: containerRef.current,
      style:     theme.url,
      center:    BCN.center,
      zoom:      BCN.zoom,
      pitch:     BCN.pitch,
      bearing:   BCN.bearing,
      antialias: true,
      minZoom:   10,
      maxZoom:   18,
      maxPitch:  65,
      minPitch:  0,
    })

    mapRef.current = map
    setMapInstance(map)

    // Tomamos control total del scroll — deshabilitamos el zoom nativo de MapLibre
    // y lo reimplementamos con detección de gesto correcta para trackpad Mac
    map.scrollZoom.disable()
    map.dragPan.enable()
    map.dragRotate.enable()

    map.on('load', () => {
      if (theme.buildings) add3DBuildings(map, theme, useMapStore.getState().showBuildings3D)
      enhanceLabels(map, mapTheme)
      styleReadyRef.current = true
      bumpStyleKey()
      setLoaded(true)
      animateIntro(map)

      // El re-enganche tras cambios de tema lo gestiona el useEffect([mapTheme])
      // mediante 'styledata'/'idle' + isStyleLoaded() — más fiable que 'style.load',
      // que MapLibre puede omitir cuando setStyle hace diff en sitio.

      map.on('moveend', () => {
        useMapStore.getState().setCamera({
          zoom:    map.getZoom(),
          pitch:   map.getPitch(),
          bearing: map.getBearing(),
          center:  [map.getCenter().lng, map.getCenter().lat],
        })
      })
    })

    const canvas = map.getCanvas()

    // Acumulador de zoom para suavizar múltiples eventos rápidos
    let zoomAccum    = 0
    let zoomRafId    = null

    const flushZoom = () => {
      if (zoomAccum === 0) return
      map.zoomTo(map.getZoom() + zoomAccum, { duration: 180 })
      zoomAccum = 0
      zoomRafId = null
    }

    // ── Gestos trackpad Mac ───────────────────────────────────────────────────
    // • pinch (ctrlKey) o scroll 2 dedos → zoom (deltaY)
    // • drag                             → pan (nativo dragPan)
    // • Ctrl+drag                        → rotate + pitch (nativo dragRotate)
    const handleScroll = (e) => {
      e.preventDefault()
      if (e.deltaY === 0) return
      zoomAccum += e.deltaY * (e.ctrlKey ? 0.02 : 0.014)
      if (!zoomRafId) zoomRafId = requestAnimationFrame(flushZoom)
    }

    canvas.addEventListener('wheel', handleScroll, { passive: false })

    return () => {
      canvas.removeEventListener('wheel', handleScroll, { capture: true })
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ── Cambio de tema en caliente ──────────────────────────────────────────────
  // setMapTheme ya pone isLoaded=false. Forzamos diff:false para garantizar que
  // MapLibre dispare 'style.load' (con diff:true puede saltarse el evento al
  // patchar el estilo en sitio). Además registramos un handler one-shot por si
  // 'style.load' no llegara: el primer 'idle' tras el cambio confirma carga.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReadyRef.current) return

    const url = MAP_THEMES[mapTheme]?.url ?? MAP_THEMES.voyager.url

    const onceStyleReady = () => {
      if (!map.isStyleLoaded()) return
      map.off('styledata', onceStyleReady)
      map.off('idle',      onceStyleReady)
      // enhanceLabels no añade fuentes externas — es seguro llamarlo aquí.
      // add3DBuildings lo gestiona el efecto de edificios cuando isLoaded pasa a true.
      // Llamarlo aquí antes de setLoaded causaba que isStyleLoaded() volviera false
      // temporalmente (al registrar la fuente vectorial OFM), bloqueando las capas.
      enhanceLabels(map, useMapStore.getState().mapTheme)
      bumpStyleKey()
      setLoaded(true)
    }

    map.on('styledata', onceStyleReady)
    map.on('idle',      onceStyleReady)
    map.setStyle(url, { diff: false })

    return () => {
      map.off('styledata', onceStyleReady)
      map.off('idle',      onceStyleReady)
    }
  }, [mapTheme])

  // ── Edificios 3D — se recalcula cada vez que cambia tema, EDI o isLoaded ────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return

    const theme = MAP_THEMES[mapTheme] ?? MAP_THEMES.voyager

    if (!theme.buildings) {
      try { map.removeLayer('buildings-3d') } catch (_) {}
      try { map.removeSource('ofm-buildings') } catch (_) {}
      return
    }

    if (map.getLayer('buildings-3d')) {
      map.setLayoutProperty('buildings-3d', 'visibility', showBuildings3D ? 'visible' : 'none')
    } else if (showBuildings3D) {
      add3DBuildings(map, theme, true)
    }
  }, [isLoaded, mapTheme, showBuildings3D])

  return <div ref={containerRef} className="w-full h-full" />
}

function add3DBuildings(map, theme, visible = true) {
  try { map.removeLayer('buildings-3d') } catch (_) {}
  try { map.removeSource('ofm-buildings') } catch (_) {}

  try {
    map.addSource('ofm-buildings', {
      type:    'vector',
      url:     'https://tiles.openfreemap.org/planet',
      minzoom: 13,
      maxzoom: 14,
    })

    const insertBefore = map.getStyle().layers.find(
      l => l.type === 'symbol' && l.layout?.['text-field']
    )?.id

    const [c0, c20, c60, c150] = theme.buildingColor

    map.addLayer({
      id:             'buildings-3d',
      type:           'fill-extrusion',
      source:         'ofm-buildings',
      'source-layer': 'building',
      layout:         { visibility: visible ? 'visible' : 'none' },
      filter:         ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-extrusion-color': [
          'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10],
          0, c0, 20, c20, 60, c60, 150, c150,
        ],
        'fill-extrusion-height':  ['coalesce', ['get', 'render_height'], 10],
        'fill-extrusion-base':    ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': theme.buildingOpacity,
      },
    }, insertBefore)
  } catch (err) {
    console.error('[buildings]', err)
  }
}

function enhanceLabels(map, theme) {
  const isDark  = theme === 'dark'
  const halo    = isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.92)'
  const width   = 1.8

  try {
    map.getStyle().layers.forEach((layer) => {
      if (layer.type !== 'symbol' || !layer.layout?.['text-field']) return
      map.setPaintProperty(layer.id, 'text-halo-color', halo)
      map.setPaintProperty(layer.id, 'text-halo-width', width)
      map.setPaintProperty(layer.id, 'text-halo-blur',  0)
      // Hacer visibles nombres de calles desde zoom 13 (solo capas de vías, no portales ni números)
      const isStreetLabel = /road|street|highway|transport|transit|place|town|city|suburb|neighbourhood|quarter|village/.test(layer.id)
      const hasHighMinzoom = layer.minzoom !== undefined && layer.minzoom > 13
      if (isStreetLabel && hasHighMinzoom) map.setLayerZoomRange(layer.id, 13, layer.maxzoom ?? 24)
    })
  } catch (_) {}
}

function animateIntro(map) {
  map.jumpTo({ center: BCN.center, zoom: 11, pitch: 0, bearing: 0 })
  setTimeout(() => {
    map.flyTo({
      center:   BCN.center,
      zoom:     BCN.zoom,
      pitch:    BCN.pitch,
      bearing:  BCN.bearing,
      duration: 3000,
      easing:   t => t * (2 - t),
    })
  }, 300)
}
