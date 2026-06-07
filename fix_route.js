const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/Map/layers/RouteLayer.jsx', 'utf8');

code = code.replace(/function clearSegments[\s\S]*?function clearWaypoints[\s\S]*?}\n/, '');

const oldSetup = `export default function RouteLayer() {
  const { mapInstance, isLoaded, styleKey } = useMapStore()
  const { route, origin, destination } = useRouteStore()
  const segIds = useRef([])

  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    clearSegments(mapInstance, segIds.current)
    clearEndpoints(mapInstance)
    clearWaypoints(mapInstance)

    const segments = route?.segments
    if (!segments?.length) return`;

const newSetup = `export default function RouteLayer() {
  const { mapInstance, isLoaded, styleKey } = useMapStore()
  const { route, origin, destination } = useRouteStore()
  const activeIds = useRef({ layers: [], sources: [] })
  const renderId = useRef(0)

  useEffect(() => {
    if (!mapInstance || !isLoaded) return

    activeIds.current.layers.forEach(id => { try { mapInstance.removeLayer(id) } catch (_) {} })
    activeIds.current.sources.forEach(id => { try { mapInstance.removeSource(id) } catch (_) {} })
    activeIds.current = { layers: [], sources: [] }

    const segments = route?.segments
    if (!segments?.length) return

    const rid = ++renderId.current;
    const addSource = (id, options) => {
      const uid = id + '-' + rid;
      mapInstance.addSource(uid, options);
      activeIds.current.sources.push(uid);
      return uid;
    };
    const addLayer = (layer) => {
      const uid = layer.id + '-' + rid;
      if (layer.source && typeof layer.source === 'string') {
        layer.source = layer.source + '-' + rid;
      }
      layer.id = uid;
      mapInstance.addLayer(layer);
      activeIds.current.layers.push(uid);
      return uid;
    };`;

code = code.replace(oldSetup, newSetup);

code = code.replace(/mapInstance\.addSource\(/g, 'addSource(');
code = code.replace(/mapInstance\.addLayer\(/g, 'addLayer(');

const oldDefensive = `      // Defensively ensure no stale source/layer with this ID exists
      try { mapInstance.removeLayer(srcId + '-glow') } catch (_) {}
      try { mapInstance.removeLayer(srcId + '-line') } catch (_) {}
      try { mapInstance.removeSource(srcId) } catch (_) {}

      try {
        segIds.current.push(srcId)`;
const newDefensive = `      try {`;
code = code.replace(oldDefensive, newDefensive);

const oldBuildings = `    if (segIds.current.length > 0 && mapInstance.getLayer('buildings-3d')) {
      try { mapInstance.moveLayer('buildings-3d', segIds.current[0] + '-glow') } catch (_) {}
    }`;
const newBuildings = `    if (activeIds.current.layers.length > 0 && mapInstance.getLayer('buildings-3d')) {
      try { mapInstance.moveLayer('buildings-3d', activeIds.current.layers[0]) } catch (_) {}
    }`;
code = code.replace(oldBuildings, newBuildings);

fs.writeFileSync('frontend/src/components/Map/layers/RouteLayer.jsx', code);
