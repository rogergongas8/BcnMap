# BCN Live — CLAUDE.md

## Visión del Proyecto

**MVP actual:** Mapa 3D interactivo de Barcelona en tiempo real con chat de IA integrado. El usuario explora el mapa en 3D, ve datos live de tráfico, Bicing, calidad del aire y clima, y puede preguntar al chat "¿cuál es el barrio más tranquilo ahora?" y el mapa reacciona visualmente.

**Visión a largo plazo:** Alternativa a Google Maps específica para Barcelona, con mayor precisión y con IA integrada en el núcleo. El usuario podrá pedir rutas multimodales personalizadas — la IA tiene en cuenta tiempo real de tráfico, disponibilidad de Bicing, horarios y estado de metro/bus, clima, calidad del aire y ubicación actual — y genera la ruta óptima combinando diferentes medios de transporte. Ejemplo: "Quiero ir al Parc Güell en 20 minutos, tengo prisa pero odio el calor" → la IA decide si Bicing, metro L3 o bus, considerando todos los datos en tiempo real.

**Estética:** Cyberpunk / futurista oscuro. Sin colores planos ni Material Design. Todo glow, blur, neón.

---

## Stack Tecnológico

### Frontend (`/frontend`)
- React 18 + Vite
- Tailwind CSS
- Framer Motion (animaciones UI)
- deck.gl (visualización de datos sobre el mapa)
- MapLibre GL JS (motor del mapa, OpenStreetMap, gratuito)
- Zustand (estado global)
- Socket.io client (WebSockets)

### Backend (`/backend`)
- Laravel 11 (PHP 8.3)
- PostgreSQL 16
- Laravel Reverb (WebSockets)
- Laravel Scheduler (cron jobs cada 2 min)
- Redis (caché de datos calientes)

### IA
- Groq API — modelo `llama-3.3-70b-versatile`
- Endpoint OpenAI-compatible

### Infraestructura
- Docker + Docker Compose
- Servicios: frontend, backend, reverb, scheduler, postgres, redis

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
                    APIs externas:
                    - Open Data BCN (tráfico)
                    - Bicing Barcelona
                    - OpenWeather
                    - AQICN (calidad del aire)
                    - TMB API (metro + bus Barcelona)
                        │
                    PostgreSQL (snapshots)
                    Redis (caché caliente)
```

El flujo de datos es: Scheduler → fetch APIs externas → guarda en PG + Redis → emite evento WebSocket → frontend actualiza capas del mapa automáticamente.

---

## Estructura de Carpetas

```
bcn-live/                          ← raíz del repo
├── CLAUDE.md
├── docker-compose.yml
├── .env                           ← variables de entorno globales
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/
│       │   ├── Map/
│       │   │   ├── MapContainer.jsx       ← contenedor principal del mapa
│       │   │   ├── MapControls.jsx
│       │   │   └── layers/
│       │   │       ├── TrafficLayer.jsx
│       │   │       ├── BicingLayer.jsx
│       │   │       ├── AirQualityLayer.jsx
│       │   │       └── BuildingsLayer.jsx
│       │   ├── Chat/
│       │   │   ├── ChatPanel.jsx
│       │   │   ├── ChatMessage.jsx
│       │   │   └── ChatInput.jsx
│       │   └── UI/
│       │       ├── LayerToggle.jsx
│       │       ├── WeatherWidget.jsx
│       │       ├── StatsPanel.jsx
│       │       └── Tooltip.jsx
│       ├── store/
│       │   ├── mapStore.js
│       │   ├── chatStore.js
│       │   └── dataStore.js
│       ├── hooks/
│       │   ├── useWebSocket.js
│       │   ├── useMapData.js
│       │   └── useChat.js
│       ├── services/
│       │   └── api.js
│       └── styles/
│           └── index.css
└── backend/
    ├── Dockerfile
    ├── composer.json
    ├── app/
    │   ├── Http/Controllers/Api/
    │   │   ├── TrafficController.php
    │   │   ├── BicingController.php
    │   │   ├── WeatherController.php
    │   │   ├── AirQualityController.php
    │   │   └── ChatController.php
    │   ├── Services/
    │   │   ├── GroqService.php
    │   │   ├── CityContextService.php     ← corazón del chat IA
    │   │   ├── TrafficService.php
    │   │   ├── BicingService.php
    │   │   ├── WeatherService.php
    │   │   └── AirQualityService.php
    │   ├── Models/
    │   │   ├── TrafficSnapshot.php
    │   │   ├── BicingSnapshot.php
    │   │   └── CitySnapshot.php
    │   ├── Console/Commands/
    │   │   └── FetchCityData.php
    │   └── Events/
    │       └── CityDataUpdated.php
    ├── routes/
    │   ├── api.php
    │   └── channels.php
    └── database/migrations/
```

---

## Modelo de Datos

### `traffic_snapshots`
```sql
id, timestamp, tramo_id, tramo_name,
lat_start, lng_start, lat_end, lng_end,
estado (fluido|lento|congestionado|cortado),
velocidad_media, created_at
```

### `bicing_snapshots`
```sql
id, timestamp, station_id, station_name, lat, lng,
bikes_available, ebikes_available, docks_available,
status (active|closed), created_at
```

### `city_snapshots`
```sql
id, timestamp, weather_temp, weather_desc, weather_icon,
air_quality_index, air_quality_level,
traffic_congestion_global (0-100),
bicing_availability_global (0-100), created_at
```

---

## API Endpoints

```
GET  /api/v1/traffic              → estado tráfico actual (Redis)
GET  /api/v1/bicing               → estaciones Bicing (Redis)
GET  /api/v1/weather              → clima actual (Redis)
GET  /api/v1/air-quality          → calidad del aire (Redis)
GET  /api/v1/city-context         → resumen ciudad para IA
POST /api/v1/chat                 → chat IA con map_actions
GET  /api/v1/traffic/history      → ?hours=24
GET  /api/v1/bicing/history       → ?hours=24
```

### Respuesta del chat
```json
{
  "reply": "string (máx 3 frases, en español)",
  "map_actions": [
    { "type": "fly_to", "lat": 41.38, "lng": 2.17, "zoom": 14 },
    { "type": "focus_layer", "layer": "bicing" },
    { "type": "highlight_zone", "zone": "eixample" },
    { "type": "highlight_stations", "station_ids": [42, 87, 103] },
    { "type": "reset_view" }
  ]
}
```

---

## Paleta de Colores (cyberpunk)

| Elemento              | Color              |
|-----------------------|--------------------|
| Tráfico fluido        | `#00ff88` (verde neón) |
| Tráfico lento         | `#ffcc00` (amarillo) |
| Tráfico cortado       | `#ff3333` (rojo) |
| Bicing disponible     | `#00aaff` (azul) |
| Bicing vacío          | `#444444` (gris) |
| Aire malo (overlay)   | rojo 30% opacidad |
| UI panels             | `rgba(0,0,0,0.85)` + border `rgba(255,255,255,0.1)` + backdrop-blur |
| Fondo del mapa        | negro / azul muy oscuro |

---

## Variables de Entorno (.env)

```env
GROQ_API_KEY=
OPENWEATHER_API_KEY=
AQICN_API_KEY=
TMB_APP_ID=           ← API de Transports Metropolitans de Barcelona (metro + bus)
TMB_APP_KEY=          ← credenciales en backend/.env

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
```

---

## Docker Compose

Servicios: `frontend` (:5173), `backend` (:8000), `reverb` (:8080), `scheduler`, `postgres` (:5432), `redis` (:6379).

Arranque: `docker compose up --build`
Verificación: `docker compose ps` → todos en estado `Up`

---

## System Prompt de Groq

```
Eres el asistente de BCN Live, app de monitorización en tiempo real de Barcelona.

DATOS ACTUALES:
{city_context}

Responde SIEMPRE en JSON exacto:
{
  "reply": "respuesta concisa en español (máx 3 frases)",
  "map_actions": [...]
}

Reglas: usa solo datos reales, no inventes, responde en español, incluye map_actions relevantes.
```

---

## Plan de Fases

### MVP (v1)
| Fase | Descripción                          | Estado |
|------|--------------------------------------|--------|
| 1    | Infraestructura base (Docker + Laravel + React) | ✅ Hecho |
| 2    | Mapa 3D base con estética cyberpunk (3 temas, edificios 3D reales) | ✅ Hecho |
| 3    | Pipeline de datos (tráfico, Bicing, clima, aire) | ✅ Hecho |
| 4    | Capas del mapa con datos reales      | ✅ Hecho |
| 5    | WebSockets tiempo real               | ✅ Hecho |
| 6    | Chat con IA (Groq + map_actions)     | 🔄 En curso |
| 7    | Histórico temporal con slider        | ⏳ Pendiente |
| 8    | Polish, optimización y deploy        | ⏳ Pendiente |

### v2 — Rutas multimodal con IA
| Fase | Descripción                          | Estado |
|------|--------------------------------------|--------|
| 9    | Integración datos TMB (metro + bus, horarios GTFS) | ⏳ Pendiente |
| 10   | Motor de rutas (Valhalla como servicio Docker) | ⏳ Pendiente |
| 11   | Rutas multimodal: pie + Bicing + metro + bus | ⏳ Pendiente |
| 12   | IA como orquestador de rutas (contexto tiempo real completo) | ⏳ Pendiente |
| 13   | UX de navegación: instrucción a instrucción, recalculo | ⏳ Pendiente |

---

## Comandos Útiles

```bash
# Levantar todo
docker compose up --build

# Sólo backend
docker compose up backend postgres redis

# Logs en tiempo real
docker compose logs -f backend

# Migrar base de datos
docker compose exec backend php artisan migrate

# Ejecutar fetch de datos manualmente
docker compose exec backend php artisan city:fetch

# Consola Laravel
docker compose exec backend php artisan tinker

# Frontend en modo dev local (sin Docker)
cd frontend && npm run dev
```

---

## Estado Actual del Mapa (MapContainer.jsx)

Tres temas implementados en `MAP_THEMES`:
- `voyager` — Carto Voyager (claro/estándar), edificios 3D activados
- `dark` — Carto Dark Matter (oscuro/cyberpunk), edificios 3D activados
- `minimal` — Carto Positron (blanco limpio), sin edificios 3D

**Edificios 3D:** Los tiles base de Carto NO incluyen datos de altura. Se usa **OpenFreeMap** como fuente secundaria (`ofm-buildings`) con schema OpenMapTiles — propiedades `render_height` y `render_min_height` de datos OSM reales. La función `add3DBuildings()` añade la fuente y la capa `fill-extrusion` solo en los temas que tienen `buildings: true`.

**Selector de tema:** En `LayerToggle.jsx`, botones ◐/◉/○ en la esquina inferior izquierda.

---

## Convenciones de Código

- **Backend PHP:** PSR-12, tipado estricto (`declare(strict_types=1)`), sin comentarios obvios
- **Frontend JS:** ESM modules, funciones arrow, sin `var`, sin `any` implícito
- **Nombres:** snake_case en PHP/BD, camelCase en JS, PascalCase en componentes React
- **Commits:** `feat:`, `fix:`, `refactor:` — sin emojis
- **No añadir** error handling para casos que no pueden ocurrir
- **No abstraer** hasta que haya 3+ usos reales
- Los datos del mapa siempre vienen del store de Zustand, nunca se pasan por props en cadena