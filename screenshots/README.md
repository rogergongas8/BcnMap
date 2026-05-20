# BcnMap · UI Kit v2 — "Registre"

Screenshots of proposed UI components for the BcnMap project.
Design direction: urban control panel aesthetic — solid surfaces, precise typography, color used semantically.

## Files

| File | Section | Components |
|------|---------|------------|
| `01-hud.png` | City HUD | 3 variants: compact, expanded with bars, minimal floating pills |
| `02-transport-cards.png` | Transport Cards | Bicing station, Metro stop (with real TMB line colors), Traffic incident, Air quality |
| `03-route.png` | Route Experience | Active route header, step-by-step instructions (numbered), Multimodal route (foot+Bicing+Metro) |
| `04-time-controls.png` | Time Controls | Historical data slider — compact and full with sparkline + playback (Phase 7) |
| `05-notifications.png` | Notifications | Toast variants: data update, traffic alert, AI response, Bicing nearby |
| `06-drawer.png` | Side Drawer | PlaceView with tabs (Info/Hours/Directions), Nearby POI list |

## Design tokens

```js
// Palette — warm, non-neon, Barcelona-specific
const ORANGE = '#E8622A'  // primary accent — actual Bicing brand color
const BLUE   = '#4D84D4'  // architectural blue
const GREEN  = '#3CB887'  // positive status
const AMBER  = '#C98E2E'  // warning
const RED    = '#D45555'  // incident / error
const PURPLE = '#8B6AD4'  // metro

// Surfaces — solid, no glassmorphism
const CARD   = '#141414'  // card background
const CARD2  = '#1C1C1C'  // elevated inner surface
const LINE   = '#262626'  // borders
const LINE2  = '#1C1C1C'  // subtle dividers (0.5px)

// Text
const T = {
  hi:    '#EBEBEB',  // primary
  mid:   '#888888',  // secondary
  lo:    '#555555',  // tertiary
  faint: '#333333',  // decorative
}
```

## Typography

```js
// Display / UI labels
const SYNE = { fontFamily: "'Syne', sans-serif" }
// Data / numbers / timestamps
const MONO = { fontFamily: "'Instrument Mono', monospace" }
```

Google Fonts: `Syne:wght@400;500;600;700` + `Instrument+Mono:wght@400;500`

## Border radius

- Cards / panels: `8px`
- Inner surfaces: `6px`
- Chips / badges: `3px`
- Buttons: `6px`
- Pills (HUD C variant): `99px`

## Card base structure

```jsx
// All transport cards use a 3px colored left accent bar
<div style={{
  background: '#141414',
  border: '1px solid #262626',
  borderRadius: 8,
  display: 'flex'
}}>
  <div style={{ width: 3, background: ORANGE /* or PURPLE, RED, GREEN */ }} />
  <div style={{ flex: 1 }}>{children}</div>
</div>
```

## Source

Interactive canvas: `BcnMap UI Kit.html`
