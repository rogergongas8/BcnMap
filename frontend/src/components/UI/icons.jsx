import React from 'react'

const svg = (props, paths) => (
  <svg
    width={props?.size ?? 16}
    height={props?.size ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={props?.strokeWidth ?? 1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={props?.style}
    className={props?.className}
  >
    {paths}
  </svg>
)

export const Icons = {
  // ── UI core
  search:      (p) => svg(p, <><circle cx="11" cy="11" r="6" /><line x1="20" y1="20" x2="15.5" y2="15.5" /></>),
  close:       (p) => svg(p, <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>),
  back:        (p) => svg(p, <polyline points="15 6 9 12 15 18" />),
  forward:     (p) => svg(p, <polyline points="9 6 15 12 9 18" />),
  arrow:       (p) => svg(p, <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" /></>),
  chevronLeft: (p) => svg(p, <polyline points="15 6 9 12 15 18" />),
  photo:       (p) => svg(p, <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M9 5l1.5-2h3L15 5" /></>),
  chevUp:      (p) => svg(p, <polyline points="6 15 12 9 18 15" />),
  filter:      (p) => svg(p, <polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" />),
  more:        (p) => svg(p, <><circle cx="5"  cy="12" r="0.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="0.6" fill="currentColor" stroke="none" /></>),
  layers:      (p) => svg(p, <><polygon points="12 2 22 8 12 14 2 8 12 2" /><polyline points="2 16 12 22 22 16" /></>),
  settings:    (p) => svg(p, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8a2 2 0 1 1-2.8 2.8a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5a2 2 0 0 1-4 0 1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3a2 2 0 1 1-2.8-2.8a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1a2 2 0 0 1 0-4a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8a2 2 0 1 1 2.8-2.8a1.7 1.7 0 0 0 1.8.3a1.7 1.7 0 0 0 1-1.5a2 2 0 0 1 4 0a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3a2 2 0 1 1 2.8 2.8a1.7 1.7 0 0 0-.3 1.8a1.7 1.7 0 0 0 1.5 1a2 2 0 0 1 0 4a1.7 1.7 0 0 0-1.5 1z" /></>),

  // ── User
  user:        (p) => svg(p, <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></>),

  // ── Navigation
  pin:         (p) => svg(p, <><path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></>),
  myLocation:  (p) => svg(p, <><circle cx="12" cy="12" r="3.5" /><circle cx="12" cy="12" r="9" /><line x1="12" y1="1" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="23" /><line x1="1"  y1="12" x2="4"  y2="12" /><line x1="20" y1="12" x2="23" y2="12" /></>),
  compass:     (p) => svg(p, <><circle cx="12" cy="12" r="9" /><polygon points="16 8 14 14 8 16 10 10 16 8" fill="currentColor" stroke="none" /></>),
  route:       (p) => svg(p, <><circle cx="6"  cy="6"  r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 6h6a4 4 0 0 1 4 4a4 4 0 0 1-4 4H10a4 4 0 0 0-4 4" /></>),
  swap:        (p) => svg(p, <><polyline points="7 4 7 20" /><polyline points="3 8 7 4 11 8" /><polyline points="17 20 17 4" /><polyline points="13 16 17 20 21 16" /></>),
  send:        (p) => svg(p, <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>),
  expand:      (p) => svg(p, <><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>),
  collapse:    (p) => svg(p, <><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></>),
  zoomIn:      (p) => svg(p, <><line x1="5" y1="12" x2="19" y2="12" /><line x1="12" y1="5" x2="12" y2="19" /></>),
  zoomOut:     (p) => svg(p, <line x1="5" y1="12" x2="19" y2="12" />),
  cube:        (p) => svg(p, <><polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2" /><line x1="12" y1="22" x2="12" y2="12" /><line x1="2"  y1="7"  x2="12" y2="12" /><line x1="22" y1="7"  x2="12" y2="12" /></>),
  building:    (p) => svg(p, <><rect x="4" y="2" width="16" height="20" rx="1" /><line x1="8"  y1="6" x2="10" y2="6" /><line x1="14" y1="6" x2="16" y2="6" /><line x1="8"  y1="11" x2="10" y2="11" /><line x1="14" y1="11" x2="16" y2="11" /><line x1="8"  y1="16" x2="10" y2="16" /><line x1="14" y1="16" x2="16" y2="16" /></>),
  home:        (p) => svg(p, <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>),

  // ── Transport
  walking:     (p) => svg(p, <><circle cx="13" cy="4" r="1.6" /><path d="M13 7L11 12 9 18" /><path d="M13 7l3 3 3 2" /><path d="M11 12l3 2v4" /><path d="M9 18l-1 4M14 18l-1 4" /></>),
  bike:        (p) => svg(p, <><circle cx="6"  cy="17" r="3.5" /><circle cx="18" cy="17" r="3.5" /><path d="M6 17 L10 8 L14 8 L18 17 M10 8 L13 17 M13 6 L16 6" /></>),
  car:         (p) => svg(p, <><path d="M3 14 L4.5 9 C4.7 8.3 5.3 8 6 8 L18 8 C18.7 8 19.3 8.3 19.5 9 L21 14 L21 18 H3 Z" /><circle cx="7" cy="17" r="1.5" /><circle cx="17" cy="17" r="1.5" /></>),
  bus:         (p) => svg(p, <><rect x="5" y="3" width="14" height="15" rx="2" /><line x1="5" y1="11" x2="19" y2="11" /><circle cx="8.5"  cy="14.5" r="1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="14.5" r="1" fill="currentColor" stroke="none" /><path d="M7 18 L5 21 M17 18 L19 21" /></>),
  metro:       (p) => svg(p, <><rect x="6" y="3" width="12" height="13" rx="3" /><line x1="6" y1="11" x2="18" y2="11" /><circle cx="9"  cy="14" r="0.8" fill="currentColor" stroke="none" /><circle cx="15" cy="14" r="0.8" fill="currentColor" stroke="none" /><path d="M8 16 L6 21 M16 16 L18 21" /></>),
  traffic:     (p) => svg(p, <><rect x="8" y="2" width="8" height="20" rx="3" /><circle cx="12" cy="7"  r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="17" r="1.5" /></>),

  // ── POI categories
  restaurant:  (p) => svg(p, <><path d="M5 3v8a3 3 0 0 0 3 3v7M8 3v6M11 3v6" /><path d="M19 3c-2 0-3 2-3 5s1 5 3 5v8" /></>),
  cafe:        (p) => svg(p, <><path d="M5 9h12v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9z" /><path d="M17 11h2a2 2 0 0 1 0 4h-2" /><path d="M8 5v-1M12 5v-1" /></>),
  bar:         (p) => svg(p, <><path d="M5 4h14l-7 8-7-8z" /><line x1="12" y1="12" x2="12" y2="20" /><line x1="8" y1="20" x2="16" y2="20" /></>),
  bakery:      (p) => svg(p, <><ellipse cx="12" cy="12" rx="8" ry="5" /><path d="M8 12c0-1.5 1-3 4-3s4 1.5 4 3" /><path d="M6 12c0-2 2-5 6-5M18 12c0-2-2-5-6-5" /></>),
  cart:        (p) => svg(p, <><path d="M3 5h2l2 11h11l2-8H7" /><circle cx="9"  cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></>),
  supermarket: (p) => svg(p, <><path d="M3 5h2l2 11h11l2-8H7" /><circle cx="9"  cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></>),
  pharmacy:    (p) => svg(p, <><rect x="3" y="9" width="18" height="6" rx="1" /><rect x="9" y="3" width="6" height="18" rx="1" /></>),
  hospital:    (p) => svg(p, <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8"  y1="12" x2="16" y2="12" /></>),
  bank:        (p) => svg(p, <><polygon points="2 9 12 3 22 9 22 11 2 11" /><line x1="5"  y1="11" x2="5"  y2="19" /><line x1="10" y1="11" x2="10" y2="19" /><line x1="14" y1="11" x2="14" y2="19" /><line x1="19" y1="11" x2="19" y2="19" /><line x1="2"  y1="21" x2="22" y2="21" /></>),
  museum:      (p) => svg(p, <><polygon points="2 9 12 3 22 9 22 11 2 11" /><line x1="6"  y1="11" x2="6"  y2="19" /><line x1="10" y1="11" x2="10" y2="19" /><line x1="14" y1="11" x2="14" y2="19" /><line x1="18" y1="11" x2="18" y2="19" /><line x1="3"  y1="21" x2="21" y2="21" /></>),
  attraction:  (p) => svg(p, <polygon points="12 2 15 9 22 10 17 15 18 22 12 18 6 22 7 15 2 10 9 9 12 2" />),
  star:        (p) => svg(p, <polygon points="12 2 15 9 22 10 17 15 18 22 12 18 6 22 7 15 2 10 9 9 12 2" />),
  calendar:    (p) => svg(p, <><rect x="3" y="4" width="18" height="17" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></>),
  ticket:      (p) => svg(p, <><path d="M3 9v-2a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4z" /><line x1="12" y1="6" x2="12" y2="18" strokeDasharray="2 2" /></>),
  monument:    (p) => svg(p, <><path d="M5 21h14M7 21V8l5-5 5 5v13" /><line x1="10" y1="13" x2="14" y2="13" /></>),
  hotel:       (p) => svg(p, <><rect x="3" y="6" width="18" height="14" rx="1" /><line x1="3" y1="11" x2="21" y2="11" /><circle cx="8" cy="9" r="0.8" fill="currentColor" stroke="none" /><line x1="3" y1="15" x2="21" y2="15" /></>),

  // ── Nature
  beach:       (p) => svg(p, <><circle cx="12" cy="7" r="2.5" /><line x1="12" y1="3" x2="12" y2="4" /><line x1="12" y1="10" x2="12" y2="11" /><line x1="7"  y1="7" x2="8" y2="7" /><line x1="16" y1="7" x2="17" y2="7" /><path d="M3 16c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5" /><path d="M3 20c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5" /></>),
  wave:        (p) => svg(p, <><path d="M2 12c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2" /><path d="M2 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2" /></>),
  sun:         (p) => svg(p, <><circle cx="12" cy="12" r="4" /><line x1="12" y1="3" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="21" /><line x1="3" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="21" y2="12" /><line x1="5.6" y1="5.6" x2="7" y2="7" /><line x1="17" y1="17" x2="18.4" y2="18.4" /><line x1="5.6" y1="18.4" x2="7" y2="17" /><line x1="17" y1="7" x2="18.4" y2="5.6" /></>),
  cloud:       (p) => svg(p, <path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.7 1A4 4 0 0 0 7 18z" />),
  rain:        (p) => svg(p, <><path d="M7 14h10a4 4 0 0 0 0-8 6 6 0 0 0-11.7 1A4 4 0 0 0 7 14z" /><line x1="9"  y1="18" x2="8"  y2="22" /><line x1="13" y1="18" x2="12" y2="22" /><line x1="17" y1="18" x2="16" y2="22" /></>),
  park:        (p) => svg(p, <><path d="M12 3l5 7h-3l4 6h-4v5h-4v-5H6l4-6H7l5-7z" /></>),

  // ── Status & actions
  alert:       (p) => svg(p, <><path d="M12 2 L2 21 H22 Z" /><line x1="12" y1="9" x2="12" y2="14" /><circle cx="12" cy="17.5" r="0.6" fill="currentColor" stroke="none" /></>),
  info:        (p) => svg(p, <><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="17" /><circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" /></>),
  check:       (p) => svg(p, <polyline points="5 12 10 17 19 7" />),
  phone:       (p) => svg(p, <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .3 2 .6 2.9a2 2 0 0 1-.5 2.1L7.9 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.5 2.9.6A2 2 0 0 1 22 16.9z" />),
  globe:       (p) => svg(p, <><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>),
  clock:       (p) => svg(p, <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" /></>),
  copy:        (p) => svg(p, <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>),
  crosshair:   (p) => svg(p, <><circle cx="12" cy="12" r="9" /><line x1="12" y1="3" x2="12" y2="7" /><line x1="12" y1="17" x2="12" y2="21" /><line x1="3" y1="12" x2="7" y2="12" /><line x1="17" y1="12" x2="21" y2="12" /></>),
  external:    (p) => svg(p, <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>),
  history:     (p) => svg(p, <><polyline points="3 12 6 9 9 12" /><path d="M6 9v3a9 9 0 1 0 3-6.7" /><polyline points="12 8 12 13 15 15" /></>),
  flag:        (p) => svg(p, <path d="M5 21V4M5 4h12l-2 4 2 4H5" />),
  message:     (p) => svg(p, <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />),
  sparkles:    (p) => svg(p, <><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" /><path d="M19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z" /></>),
  bookmark:    (p) => svg(p, <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />),
  save:        (p) => svg(p, <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>),
}

/** Path strings for SVG markers built outside React (maplibre Markers). */
export const ICON_PATHS = {
  restaurant:  '<path d="M5 3v8a3 3 0 0 0 3 3v7M8 3v6M11 3v6"/><path d="M19 3c-2 0-3 2-3 5s1 5 3 5v8"/>',
  cafe:        '<path d="M5 9h12v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9z"/><path d="M17 11h2a2 2 0 0 1 0 4h-2"/><path d="M8 5v-1M12 5v-1"/>',
  bar:         '<path d="M5 4h14l-7 8-7-8z"/><line x1="12" y1="12" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/>',
  bakery:      '<ellipse cx="12" cy="12" rx="8" ry="5"/><path d="M8 12c0-1.5 1-3 4-3s4 1.5 4 3"/><path d="M6 12c0-2 2-5 6-5M18 12c0-2-2-5-6-5"/>',
  supermarket: '<path d="M3 5h2l2 11h11l2-8H7"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
  cart:        '<path d="M3 5h2l2 11h11l2-8H7"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
  pharmacy:    '<rect x="3" y="9" width="18" height="6" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/>',
  hospital:    '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
  bank:        '<polygon points="2 9 12 3 22 9 22 11 2 11"/><line x1="5" y1="11" x2="5" y2="19"/><line x1="10" y1="11" x2="10" y2="19"/><line x1="14" y1="11" x2="14" y2="19"/><line x1="19" y1="11" x2="19" y2="19"/><line x1="2" y1="21" x2="22" y2="21"/>',
  museum:      '<polygon points="2 9 12 3 22 9 22 11 2 11"/><line x1="6" y1="11" x2="6" y2="19"/><line x1="10" y1="11" x2="10" y2="19"/><line x1="14" y1="11" x2="14" y2="19"/><line x1="18" y1="11" x2="18" y2="19"/><line x1="3" y1="21" x2="21" y2="21"/>',
  attraction:  '<polygon points="12 2 15 9 22 10 17 15 18 22 12 18 6 22 7 15 2 10 9 9 12 2"/>',
  star:        '<polygon points="12 2 15 9 22 10 17 15 18 22 12 18 6 22 7 15 2 10 9 9 12 2"/>',
  monument:    '<path d="M5 21h14M7 21V8l5-5 5 5v13"/><line x1="10" y1="13" x2="14" y2="13"/>',
  hotel:       '<rect x="3" y="6" width="18" height="14" rx="1"/><line x1="3" y1="11" x2="21" y2="11"/><circle cx="8" cy="9" r="0.8" fill="currentColor" stroke="none"/><line x1="3" y1="15" x2="21" y2="15"/>',
  beach:       '<circle cx="12" cy="7" r="2.5"/><line x1="12" y1="3" x2="12" y2="4"/><line x1="12" y1="10" x2="12" y2="11"/><line x1="7" y1="7" x2="8" y2="7"/><line x1="16" y1="7" x2="17" y2="7"/><path d="M3 16c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5"/><path d="M3 20c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5"/>',
  wave:        '<path d="M2 12c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><path d="M2 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/>',
  alert:       '<path d="M12 2 L2 21 H22 Z"/><line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17.5" r="0.6" fill="currentColor" stroke="none"/>',
  pin:         '<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
}

export function iconHtml(name, { size = 14, stroke = '#0a0a0a', strokeWidth = 1.8 } = {}) {
  const paths = ICON_PATHS[name]
  if (!paths) return ''
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
}

export const POI_CATEGORY_COLORS = {
  restaurant: '#f97316',
  cafe:       '#a16207',
  bar:        '#a855f7',
  bakery:     '#eab308',
  supermarket:'#22c55e',
  pharmacy:   '#10b981',
  hospital:   '#ef4444',
  bank:       '#0ea5e9',
  museum:     '#8b5cf6',
  attraction: '#ec4899',
  monument:   '#94a3b8',
  hotel:      '#06b6d4',
}
