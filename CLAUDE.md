# BCN Live — CLAUDE.md

## Visión del Proyecto

**Estado actual:** Mapa 3D interactivo de Barcelona con chat de IA integrado, rutas multimodales (pie, Bicing, metro, coche), navegación turn-by-turn, auth de usuarios, slider histórico y PWA. La IA actúa como orquestador: entiende el contexto de la ciudad (tráfico, clima, Bicing, disrupciones metro) y genera la ruta óptima automáticamente.

**Visión a largo plazo:** Alternativa a Google Maps específica para Barcelona. El usuario dice "Quiero ir al Parc Güell en 20 minutos, tengo prisa pero odio el calor" → la IA decide el modo óptimo en tiempo real y muestra la ruta en el mapa.

**Estética:** Cyberpunk / futurista oscuro. Sin colores planos ni Material Design. Todo glow, blur, neón.

---

## Stack Tecnológico

### Frontend (`/frontend`)
- React 18 + Vite 8
- Tailwind CSS 3 + Framer Motion 11
- MapLibre GL JS 4 (motor del mapa, tiles OpenFreeMap/Carto)
- deck.gl 9 (capas de datos sobre el mapa)
- Zustand 4 (estado global — 9 stores)
- Laravel Echo + pusher-js (WebSockets)
- vite-plugin-pwa (PWA + Workbox)

### Backend (`/backend`)
- Laravel 11 (PHP 8.3), tipado estricto PSR-12
- PostgreSQL 16 (snapshots históricos)
- Redis (caché caliente de datos en tiempo real)
- Laravel Reverb (WebSockets, :8080)
- Laravel Scheduler (cron cada 2 min)
- Laravel Sanctum (autenticación API token)

### IA y Routing
- Groq API — modelo `gemma2-9b-it` (gratuito, buena adherencia a JSON)
- Valhalla (Docker, :8002) — routing foot/bicycle/auto con instrucciones en español
- MetroRouter interno — Dijkstra con penalización de transbordos (240s), velocidad 6.5 m/s

### APIs externas
- Open Data BCN (tráfico)
- Bicing Barcelona
- OpenWeather (clima)
- AQICN (calidad del aire)
- TMB API (metro + bus Barcelona)
- Foursquare (fotos, rating, horarios de POIs)
- Wikipedia/Wikimedia (descripción + fotos para landmarks)
- OpenTripMap (enriquecimiento POI fallback)

### Infraestructura
- Docker + Docker Compose
- Servicios: `frontend` (:5173), `backend` (:8000), `reverb` (:8080), `scheduler`, `valhalla` (:8002), `postgres` (:5432), `redis` (:6379)

---

## Arquitectura

```
Frontend (React + MapLibre + deck.gl)
    │
    ├── HTTP REST → Laravel API (/api/v1/...)
    └── WebSocket → Laravel Reverb (:8080)
                        │
                    Scheduler (cada 2 min)
                        │
                    APIs externas (tráfico, Bicing, clima, aire, TMB)
                        │
                    PostgreSQL (snapshots históricos)
                    Redis (caché caliente)

Routing: Frontend → /api/v1/route → RouteService → Valhalla (:8002) + MetroRouter
IA: Frontend → /api/v1/chat → ChatController → CityContextService (Redis 120s) → GroqService
Plan IA: Frontend → /api/v1/route/plan → RouteService.planMultimodal() → 4 modos en paralelo → scoring
```

---

## Estructura de Carpetas (estado real)

```
BcnMap/
├── CLAUDE.md
├── docker-compose.yml
├── frontend/
│   ├── vite.config.js              ← VitePWA configurado
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── Map/
│       │   │   ├── MapContainer.jsx        ← mapa principal, 3 temas
│       │   │   ├── MapControls.jsx
│       │   │   ├── CameraControls.jsx
│       │   │   ├── MapClickHandler.jsx
│       │   │   └── layers/
│       │   │       ├── TrafficLayer.jsx
│       │   │       ├── BicingLayer.jsx
│       │   │       ├── AirQualityLayer.jsx
│       │   │       ├── MetroLayer.jsx
│       │   │       ├── BusLayer.jsx
│       │   │       ├── RouteLayer.jsx
│       │   │       ├── NearbyPoiLayer.jsx
│       │   │       ├── BeachLayer.jsx
│       │   │       ├── LandmarksLayer.jsx
│       │   │       ├── PinLayer.jsx
│       │   │       └── UserLocationLayer.jsx
│       │   ├── Chat/
│       │   │   ├── ChatPanel.jsx           ← panel lateral, escucha pendingPrompt
│       │   │   ├── ChatMessage.jsx
│       │   │   └── ChatInput.jsx
│       │   ├── Route/
│       │   │   ├── SearchBar.jsx           ← búsqueda, 4 modos en paralelo, RouteStepPanel
│       │   │   ├── NavigationHUD.jsx       ← HUD navegación turn-by-turn
│       │   │   └── RoutePanel.jsx
│       │   └── UI/
│       │       ├── Drawer/
│       │       │   ├── SideDrawer.jsx
│       │       │   ├── NearbyView.jsx      ← lista POIs + "Preguntar al asistente"
│       │       │   └── PlaceView.jsx       ← card de lugar con enriquecimiento
│       │       ├── FloatingToolbar.jsx     ← toolbar izquierda + ProfileButton (auth)
│       │       ├── LoginModal.jsx          ← modal login/registro (Sanctum)
│       │       ├── HistorySlider.jsx       ← slider temporal 24h
│       │       ├── CityHud.jsx
│       │       ├── WeatherWidget.jsx
│       │       ├── StatsPanel.jsx
│       │       ├── ErrorBoundary.jsx
│       │       ├── Tooltip.jsx
│       │       └── icons.jsx               ← todos los SVG icons del proyecto
│       ├── store/
│       │   ├── mapStore.js         ← mapInstance, userLocation, flyTo, mapTheme, activeLayers
│       │   ├── dataStore.js        ← traffic[], bicing[], bus[], metro[], metroLines[], weather, airQuality
│       │   ├── chatStore.js        ← messages, isLoading, pendingPrompt, openChatWithPrompt
│       │   ├── routeStore.js       ← origin, destination, mode, route, isNavigating, chatRequest
│       │   ├── drawerStore.js      ← view, place, openPlace, openNearby, close, back
│       │   ├── nearbyStore.js      ← activeCategory, pois, isLoading, hoveredId
│       │   ├── authStore.js        ← user, token, isLogged, setAuth, logout (localStorage)
│       │   ├── timeStore.js        ← isHistorical, selectedAt, setHistorical, setLive
│       │   └── leisureStore.js     ← showBeaches
│       ├── hooks/
│       │   ├── useChat.js          ← sendMessage, executeMapActions (plan_trip, open_place, calculate_route...)
│       │   ├── useMapData.js       ← fetch datos con soporte modo histórico
│       │   ├── useNavigation.js    ← GPS turn-by-turn, advance step, off-route detection
│       │   ├── useNearbyPois.js
│       │   ├── useLeisureData.js
│       │   ├── useAuth.js
│       │   ├── useRoute.js
│       │   └── useWebSocket.js
│       ├── services/
│       │   └── api.js              ← todos los endpoints + auth + favorites + fetchRoutePlan
│       └── utils/
│           ├── geocode.js
│           └── reverseGeocode.js
└── backend/
    ├── app/
    │   ├── Http/Controllers/Api/
    │   │   ├── ChatController.php          ← cacha base context en Redis (120s)
    │   │   ├── RouteController.php         ← calculate + plan (multimodal)
    │   │   ├── MetroController.php         ← current, lines, arrivals, disruptions
    │   │   ├── BusController.php
    │   │   ├── PoiController.php           ← nearby, search, categories
    │   │   ├── PlaceEnrichController.php   ← Foursquare + Wikipedia merge
    │   │   ├── AuthController.php          ← register, login, logout, me (Sanctum)
    │   │   ├── FavoriteController.php
    │   │   ├── SavedRouteController.php
    │   │   ├── EventsController.php
    │   │   ├── BeachController.php
    │   │   ├── HistoryController.php
    │   │   ├── TrafficController.php
    │   │   ├── BicingController.php
    │   │   ├── WeatherController.php
    │   │   └── AirQualityController.php
    │   └── Services/
    │       ├── GroqService.php             ← gemma2-9b-it, system prompt con plan_trip/open_place/calculate_route
    │       ├── CityContextService.php      ← buildBaseContext() + appendUserData(), incluye disrupciones metro
    │       ├── RouteService.php            ← calculate() + planMultimodal() + scoreRoutes()
    │       ├── MetroRouter.php             ← Dijkstra, penalización transbordos 240s
    │       ├── MetroService.php            ← estaciones TMB, líneas, arrivals, disruptions
    │       ├── PlaceEnrichService.php      ← Wikipedia/Wikimedia
    │       ├── FoursquareService.php       ← fotos, rating, horarios, precio
    │       ├── PoiService.php
    │       ├── BeachService.php
    │       ├── EventsService.php
    │       ├── BicingService.php
    │       ├── TrafficService.php
    │       ├── WeatherService.php
    │       └── AirQualityService.php
    └── routes/
        └── api.php
```

---

## API Endpoints (estado actual)

```
# Datos en tiempo real
GET  /api/v1/traffic
GET  /api/v1/bicing
GET  /api/v1/weather
GET  /api/v1/air-quality
GET  /api/v1/metro
GET  /api/v1/metro/lines
GET  /api/v1/metro/disruptions
GET  /api/v1/metro/{stationId}/arrivals
GET  /api/v1/bus
GET  /api/v1/bus/{stopId}/arrivals

# Chat IA (throttle 20/min)
POST /api/v1/chat                 → { reply, map_actions[] }

# Routing (throttle 30/min y 20/min)
GET  /api/v1/route?from_lat&from_lng&to_lat&to_lng&mode
GET  /api/v1/route/plan?from_lat&from_lng&to_lat&to_lng&constraint  ← NUEVO: 4 modos + recomendación

# POIs
GET  /api/v1/pois/nearby?lat&lng&radius&categories
GET  /api/v1/pois/search?q&lat&lng
GET  /api/v1/pois/categories
GET  /api/v1/pois/enrich?name&lat&lng&category   ← Foursquare + Wikipedia merge

# Playas
GET  /api/v1/beaches

# Eventos
GET  /api/v1/events/today
GET  /api/v1/events/nearby?lat&lng&radius

# Histórico
GET  /api/v1/history/timeline?hours&step
GET  /api/v1/history/snapshot?at=ISO
GET  /api/v1/history/range

# Auth — Sanctum (throttle 10/min para login/register)
POST /api/v1/auth/register
POST /api/v1/auth/login           → { token, user }
POST /api/v1/auth/logout          (auth:sanctum)
GET  /api/v1/auth/me              (auth:sanctum)

# Favoritos y rutas guardadas (auth:sanctum)
GET|POST        /api/v1/favorites
DELETE          /api/v1/favorites/{id}
GET|POST        /api/v1/saved-routes
DELETE          /api/v1/saved-routes/{id}

# Trajectes recurrents (auth:sanctum)
GET|POST        /api/v1/commutes
PUT|DELETE      /api/v1/commutes/{id}
GET             /api/v1/commutes/{id}/status   ← leave_by, next_departure, travel_minutes
```

---

## Map Actions del Sistema de IA

El chat devuelve `{ reply, map_actions[] }`. Acciones soportadas:

| Tipo | Cuándo | Params clave |
|------|--------|--------------|
| `fly_to` | Centrar mapa | lat, lng, zoom |
| `reset_view` | Volver a BCN center | — |
| `open_place` | Recomendar un lugar concreto | name, lat, lng, category |
| `plan_trip` | Usuario quiere ir a algún sitio sin modo específico | origin_*, dest_*, constraint |
| `calculate_route` | Usuario especifica modo explícito ("en metro", "a pie"...) | origin_*, dest_*, mode |
| `focus_layer` | Activar capa del mapa | layer |
| `highlight_zone` | Destacar zona | zone |

**Regla IA:**
- Pregunta por lugar → `open_place`
- "Quiero ir / llévame" sin modo → `plan_trip` (el backend calcula y recomienda el modo óptimo)
- "Quiero ir en metro / a pie..." → `calculate_route`

---

## Flujo plan_trip (Phase 4)

1. Usuario: "Quiero ir al Camp Nou, tengo prisa"
2. Groq → `plan_trip` con `constraint: "tengo prisa"`
3. `/route/plan` → `RouteService.planMultimodal()` calcula los 4 modos
4. `scoreRoutes()` penaliza: coche con congestión ×1.5, bici con lluvia ×3, a pie >3km ×1.8
5. Devuelve `{ recommended, options: { foot, bicing, bus, car } }`
6. SearchBar hidrata los 4 previews directamente (sin refetch)
7. Reply IA explica el modo elegido con contexto real

---

## Flujo Navegación Turn-by-Turn

1. `RouteService` parsea maneuvers de Valhalla → `steps[]` (instruction, type, distance, shape_index)
2. SearchBar muestra `RouteStepPanel` con botón "▶ Navegar"
3. `startNavigation()` → `routeStore.isNavigating = true`
4. `useNavigation.js` escucha `userLocation` → haversine al punto del step actual
5. < 30m → `advanceStep()`, > 150m → `offRoute = true` (barra de aviso)
6. `NavigationHUD.jsx` muestra instrucción, distancia al giro, preview del siguiente step

---

## Enriquecimiento de POIs (PlaceView)

`GET /api/v1/pois/enrich` → merge Foursquare + Wikipedia:
- **Foursquare**: fotos (hasta 5), rating, precio, horarios actuales, is_open_now, website, phone
- **Wikipedia**: descripción, foto hero, wiki_url
- Prioridad: Foursquare para datos comerciales, Wikipedia para landmarks históricos

---

## Paleta de Colores (cyberpunk)

| Elemento              | Color              |
|-----------------------|--------------------|
| Tráfico fluido        | `#00ff88` |
| Tráfico lento         | `#ffcc00` |
| Tráfico cortado       | `#ff3333` |
| Bicing disponible     | `#00aaff` |
| Ruta a pie            | `#a78bfa` |
| Ruta bici             | `#00ff88` |
| Ruta coche            | `#ffaa00` |
| Ruta metro            | `#ff6b35` |
| Ruta bus              | `#00b4ff` |
| UI panels             | `rgba(0,0,0,0.85)` + `border rgba(255,255,255,0.1)` + backdrop-blur |
| Fondo del mapa        | `#0a0c10` |

---

## Variables de Entorno (backend/.env)

```env
GROQ_API_KEY=
OPENWEATHER_API_KEY=
AQICN_API_KEY=
TMB_APP_ID=
TMB_APP_KEY=
FOURSQUARE_API_KEY=         ← fotos/rating/horarios POIs (opcional pero recomendado)
OPENTRIPMAP_API_KEY=        ← fallback enriquecimiento POI

DB_CONNECTION=pgsql
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=bcnlive
DB_USERNAME=bcnlive
DB_PASSWORD=bcnlive

REDIS_HOST=redis
REDIS_PORT=6379

REVERB_APP_ID=bcnlive
REVERB_APP_KEY=bcnlive_key
REVERB_APP_SECRET=bcnlive_secret
REVERB_HOST=reverb
REVERB_PORT=8080

VALHALLA_URL=http://valhalla:8002
```

---

## Temas del Mapa

Tres temas en `MAP_THEMES` (MapContainer.jsx):
- `voyager` — Carto Voyager (claro/estándar), edificios 3D
- `dark` — Carto Dark Matter (oscuro/cyberpunk), edificios 3D  ← default
- `minimal` — Carto Positron (blanco limpio), sin edificios 3D

**Edificios 3D:** Tiles base de Carto no tienen alturas. Se usa OpenFreeMap (`ofm-buildings`) con schema OpenMapTiles — propiedades `render_height` / `render_min_height` de OSM.

---

## Plan de Fases (estado real)

### v1 — MVP
| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Infraestructura base (Docker + Laravel + React) | ✅ |
| 2 | Mapa 3D cyberpunk (3 temas, edificios 3D reales OSM) | ✅ |
| 3 | Pipeline de datos (tráfico, Bicing, clima, aire, metro, bus) | ✅ |
| 4 | Capas del mapa con datos reales (deck.gl) | ✅ |
| 5 | WebSockets tiempo real (Laravel Reverb) | ✅ |
| 6 | Chat IA (Groq gemma2-9b-it, map_actions, Redis context cache) | ✅ |
| 7 | Slider histórico 24h (timeStore, HistorySlider, useMapData) | ✅ |

### v2 — Features avanzadas
| Fase | Descripción | Estado |
|------|-------------|--------|
| TMB | Integración datos metro + bus (estaciones, líneas, arrivals, disrupciones) | ✅ |
| Routing | Valhalla Docker + modos foot/bike/bicing/car/bus | ✅ |
| Nav | Navegación turn-by-turn GPS (NavigationHUD, useNavigation) | ✅ |
| POIs | Búsqueda nearby + enriquecimiento Foursquare + Wikipedia | ✅ |
| Auth | Sanctum (register/login/favorites/saved-routes) | ✅ |
| PWA | vite-plugin-pwa + Workbox (NetworkFirst live data, CacheFirst tiles) | ✅ |
| Phase 4 | IA orquestador multimodal — plan_trip, planMultimodal(), scoring | ✅ |

### Pendiente
| Descripción | Notas |
|-------------|-------|
| Predicciones por hora/día | `/api/v1/predictions?zone=X&hour=Y` usando snapshots PostgreSQL |
| Smart Commute Notifications | Rutas recurrentes (home→work, días+hora), scheduler calcula "salir a X:XX" con datos TMB en tiempo real, Web Push notification via PWA |
| Deploy | Vercel (frontend) + servidor VPS (backend + Docker) |

---

## Comandos Útiles

```bash
# Levantar todo
docker compose up --build

# Logs en tiempo real
docker compose logs -f backend

# Migrar base de datos
docker compose exec backend php artisan migrate

# Instalar Sanctum (si no está)
docker compose exec backend composer require laravel/sanctum
docker compose exec backend php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
docker compose exec backend php artisan migrate

# Fetch de datos manual
docker compose exec backend php artisan city:fetch

# Frontend en modo dev local
cd frontend && npm run dev

# Build frontend
cd frontend && npm run build
```

---

## Convenciones de Código

- **Backend PHP:** PSR-12, `declare(strict_types=1)`, sin comentarios obvios
- **Frontend JS:** ESM modules, funciones arrow, sin `var`
- **Nombres:** snake_case en PHP/BD, camelCase en JS, PascalCase en componentes React
- **Commits:** `feat:`, `fix:`, `refactor:` — sin emojis
- **No añadir** error handling para casos imposibles
- **No abstraer** hasta que haya 3+ usos reales
- Los datos del mapa siempre vienen del store de Zustand, nunca por props en cadena
- Los stores no importan otros stores — coordinación en hooks o handlers

## Forma de Trabajar con Roger

- **Preguntar antes de editar:** Ante cualquier tarea de UI/UX o bug poco definido, leer el código relevante primero y luego hacer las preguntas necesarias al usuario antes de tocar nada. No implementar suposiciones.
