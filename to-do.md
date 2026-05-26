# BCN Live — Backlog

## Fet recentment ✅

- **CityHud a la TopBar**: widget de clima/trànsit/aire integrat com a pill inline a la barra superior; hover → dropdown expandit
- **HistorySlider eliminat**: component retirat de l'app (poc valor per l'usuari)
- **Fix metro: línia + direcció**: `StepNodeMetro` mostra la línia correcta i el `stationId` de sortida
- **SearchBar centrat**: eliminada la lògica `hShift` que desplaçava el dropdown quan el chat era obert
- **Mapa fix quan s'obre el drawer**: eliminat el padding esquerre que feia moure el mapa en obrir els toggles
- **LoginModal redissenyada**: paleta càlida barcelonesa (terracota #E8622A), silueta skyline SVG, sense neons
- **Events al mapa**: vegeu apartat "Events de Barcelona al mapa" a sota

---

## En curs / Pròximament

### Metro: línia + direcció a la ruta
Mostrar clarament a RouteStepPanel quan hi ha segments de metro:
- Nom de la línia (L1, L3, L5…) amb el seu color oficial
- Direcció final del tren (ex. "direcció Zona Universitària")
- Sentit calculat a partir de `meta.to_station` vs. llista ordenada d'estacions de cada línia
- Afecta: `StepNodeMetro`, `StepNodeTransfer` i `ModeCard` (badge de línia)

### Selector d'idioma (ca / es / en)
Toggle de 3 opcions a la TopBar (o al menú de perfil).
- Internacionalització amb `i18next` + `react-i18next`
- Traducció de tota la UI: labels, placeholders, missatges d'IA, instruccions de ruta
- L'IA (Groq) rep el `lang` al system prompt per respondre en l'idioma triat
- Persists a `localStorage`

---

## Features pendents

### Prediccions de trànsit per hora
- Usar snapshots de PostgreSQL per inferir patrons per franja horària
- Endpoint: `GET /api/v1/predictions?zone=X&hour=Y`
- Overlay al mapa: tonalitat de gris/taronja indicant congestió prevista
- Útil per planificar rutas ("si surts a les 18h, tarda +12 min")

### Alertes de disrupció metro en temps real
- Badge vermell sobre la capa Metro quan `GET /api/v1/metro/disruptions` retorna incidents actius
- Notificació flotant breu (toast) quan arriba una nova disrupció per WebSocket
- Llista de disrupcions a la vista del drawer si l'usuari toca el badge

### Horaris de transport públic
- Taula completa d'horaris per a una línia de metro/bus seleccionada
- Integrar dades TMB (`/arrivals` ja existeix; falta la vista)
- Accessible des del `StepNodeMetro` — tap → "Veure horaris"

### Incidents reportats per usuaris
- Botó "Reportar incident" quan l'usuari fa long-press al mapa
- Tipus: tall de carrer, accident, obres, avaria Bicing
- Guardats a PostgreSQL; visible a la capa de trànsit com a pin especial
- Expiració automàtica a les 2h si ningú el confirma

### Events de Barcelona al mapa ✅
- EventsLayer al mapa (deck.gl) amb punts per categoria i colors
- Drawer `EventsView` amb filtres per categoria (Tots / Música / Cultura / Esport / Gastro / Família)
- Dues fonts integrades: **BCN Open Data** (exposicions, teatre, tallers, cultura) + **Ticketmaster** (concerts, espectacles ticketats)
- Deduplicació creuada entre fonts per evitar duplicats (TM guanya si coincideix títol+data)
- Refresc diari a les 04:00 via `events:refresh` — 1 crida/dia a cada API (Ticketmaster: 1/5000 del límit diari)
- Cache 24h: BCN · Ticketmaster · enriquiment
- Context IA: resum de 15 esdeveniments al `CityContextService` (cap al prompt de sistema en cada missatge — no és gratuït en tokens)
- **Pendent**: integrar events com a POIs a `NearbyView`

### Millora UX mode navegació
- Geofencing: detectar arribada al destí (< 30m) i mostrar pantalla de "Has arribat"
- Rerouting automàtic silenciós (sense avís visual agressiu, simplement recalcula)
- Velocitat actual de l'usuari a la NavigationHUD (km/h des del GPS)

### PWA — Notificacions push
- Alertes de Bicing: "l'estació X a prop teu s'està omplint / buidant"
- Alertes de disrupció metro quan l'usuari té una ruta activa que en depèn
- Requereix backend: `POST /api/v1/push/subscribe` + Web Push API

### Compartir lloc (no només ruta)
- Afegir `?place=lat,lng&name=xxx` per obrir directament el PlaceView d'un lloc
- Útil per recomanar restaurants, landmarks, etc.

### Estadístiques d'ús personal (usuaris autenticats)
- Quants km ha fet l'usuari per cada mode de transport
- Quantes rutes guardades, llocs favorits
- Pantalla "El teu BCN" al menú de perfil

### Deploy
- Frontend → Vercel (build automàtic des de `main`)
- Backend → VPS amb Docker Compose (Laravel + Reverb + Postgres + Redis + Valhalla)
- Variables d'entorn: veure secció del CLAUDE.md
- CI: GitHub Actions per lint + build en cada PR

---

## Millores de UI/UX

- [ ] Animació de transició entre fases del SearchBar (pill → search → options) més suau
- [ ] Mode compacte de la TopBar en mòbil (< 640px): ocultar stats de ciutat, col·lapsar botons
- [ ] Tema clar opcional (ja existeix `voyager` al mapa, falta adaptar els panels)
- [ ] Skeleton loaders als PlaceView i NearbyView mentre carreguen les dades
- [ ] Haptic feedback al mòbil (navigator.vibrate) en accions clau (ruta calculada, navegació iniciada)
- [ ] Onboarding: primer ús → breu tutorial de 3 passos (mapa, buscador, IA)
