import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icons, POI_CATEGORY_COLORS } from '../icons'
import { useDrawerStore } from '../../../store/drawerStore'
import { useMapStore } from '../../../store/mapStore'
import { useRouteStore } from '../../../store/routeStore'
import { fetchPlaceEnrich } from '../../../services/api'

/* ── Constants ─────────────────────────────────────────────────────────── */

const C = {
  orange: '#E8622A',
  blue:   '#4D84D4',
  green:  '#3CB887',
  amber:  '#C98E2E',
  red:    '#D45555',
}

const FLAG_LABEL = { green: 'Bandera verda', yellow: 'Bandera groga', red: 'Bandera vermella' }
const FLAG_COLOR = { green: C.green, yellow: C.amber, red: C.red }
const OCC_LABEL  = { low: 'Poca afluència', medium: 'Afluència moderada', high: 'Molta afluència' }
const OCC_COLOR  = { low: C.green, medium: C.amber, high: C.red }

const CATEGORY_ICONS = {
  restaurant: Icons.restaurant, cafe: Icons.cafe, bar: Icons.bar,
  bakery: Icons.bakery, supermarket: Icons.supermarket, pharmacy: Icons.pharmacy,
  hospital: Icons.hospital, bank: Icons.bank, museum: Icons.museum,
  attraction: Icons.attraction, monument: Icons.monument, hotel: Icons.hotel,
}

/* ── Small helpers ──────────────────────────────────────────────────────── */

function DataRow({ label, value, color, pct }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: '#555' }}>{label}</span>
        <span className="font-mono text-[11px] font-medium" style={{ color: color ?? '#EBEBEB' }}>{value}</span>
      </div>
      {pct != null && (
        <div className="h-[2px] w-full rounded-full" style={{ background: '#262626' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color ?? '#888' }} />
        </div>
      )}
    </div>
  )
}

function MetaRow({ icon: Icon, children, href }) {
  if (!children) return null
  const content = (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="flex-shrink-0 mt-0.5" style={{ color: '#555' }}><Icon size={13} /></span>
      <span className="font-mono text-[11px] leading-snug min-w-0 break-words" style={{ color: '#888' }}>{children}</span>
    </div>
  )
  if (href) return <a href={href} target="_blank" rel="noreferrer" className="block hover:opacity-80 transition-opacity">{content}</a>
  return content
}

function StarRating({ rating }) {
  if (rating == null) return null
  const full  = Math.floor(rating)
  const half  = rating - full >= 0.25 && rating - full < 0.75
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: full  }).map((_, i) => <StarFull  key={`f${i}`} />)}
        {half && <StarHalf />}
        {Array.from({ length: empty }).map((_, i) => <StarEmpty key={`e${i}`} />)}
      </div>
      <span className="font-mono text-[12px] font-semibold tabular-nums" style={{ color: '#EBEBEB' }}>{rating.toFixed(1)}</span>
    </div>
  )
}

const StarFull  = () => <svg width="11" height="11" viewBox="0 0 12 12" fill="#C98E2E"><path d="M6 1l1.4 2.8 3.1.45-2.25 2.2.53 3.1L6 8.1 3.22 9.55l.53-3.1L1.5 4.25l3.1-.45z"/></svg>
const StarHalf  = () => <svg width="11" height="11" viewBox="0 0 12 12"><path d="M6 1l1.4 2.8 3.1.45-2.25 2.2.53 3.1L6 8.1V1z" fill="#C98E2E"/><path d="M6 1L4.6 3.8l-3.1.45 2.25 2.2-.53 3.1L6 8.1V1z" fill="#1C1C1C"/></svg>
const StarEmpty = () => <svg width="11" height="11" viewBox="0 0 12 12" fill="#262626"><path d="M6 1l1.4 2.8 3.1.45-2.25 2.2.53 3.1L6 8.1 3.22 9.55l.53-3.1L1.5 4.25l3.1-.45z"/></svg>

/* ── Photo / Hero ───────────────────────────────────────────────────────── */

function PlaceHero({ photos, category }) {
  const [idx,      setIdx]      = useState(0)
  const [loaded,   setLoaded]   = useState(false)
  const [imgError, setImgError] = useState(false)

  const showPhoto = photos?.length > 0 && !imgError
  const catId     = category?.id ?? 'attraction'
  const accent    = POI_CATEGORY_COLORS[catId] ?? '#8b5cf6'
  const CatIcon   = CATEGORY_ICONS[catId] ?? Icons.pin

  if (!showPhoto) {
    return (
      <div className="relative w-full h-[120px] flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${accent}18 0%, ${accent}06 100%)`, borderBottom: '1px solid #262626' }}>
        <div className="w-14 h-14 rounded-xl flex items-center justify-center"
          style={{ background: `${accent}14`, boxShadow: `0 0 32px ${accent}28` }}>
          <span style={{ color: accent, opacity: 0.85 }}><CatIcon size={28} /></span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-[150px] overflow-hidden flex-shrink-0" style={{ borderBottom: '1px solid #262626' }}>
      <AnimatePresence mode="wait">
        <motion.img
          key={photos[idx]}
          src={photos[idx]}
          alt=""
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: loaded ? 1 : 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32 }}
          onLoad={() => setLoaded(true)}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-[#141414]/80 via-transparent to-transparent pointer-events-none" />
      {photos.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <button key={i} onClick={() => { setIdx(i); setLoaded(false) }}
              className="w-1.5 h-1.5 rounded-full transition-all"
              style={{ background: i === idx ? '#fff' : 'rgba(255,255,255,0.3)', transform: i === idx ? 'scale(1.3)' : 'scale(1)' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Enrichment hook ────────────────────────────────────────────────────── */

function usePlaceEnrich(place) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (place?.kind !== 'poi') { setData(null); return }
    let cancelled = false
    setData(null)
    setLoading(true)
    fetchPlaceEnrich(place.name, place.lat, place.lng, place.category?.id ?? '')
      .then(res => { if (!cancelled) setData(res?.data ?? null) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [place?.id])
  return { data, loading }
}

/* ── Tabs ───────────────────────────────────────────────────────────────── */

const TABS = [
  { id: 'info',      label: 'Info' },
  { id: 'horaris',   label: 'Horaris' },
  { id: 'ruta',      label: 'Com arribar-hi' },
]

function TabBar({ active, onChange }) {
  return (
    <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid #262626' }}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className="flex-1 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors relative"
          style={{ color: active === tab.id ? '#EBEBEB' : '#555' }}
        >
          {tab.label}
          {active === tab.id && (
            <motion.div
              layoutId="tab-underline"
              className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
              style={{ background: '#E8622A' }}
              transition={{ type: 'spring', stiffness: 400, damping: 38 }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

/* ── Tab: Info ──────────────────────────────────────────────────────────── */

function InfoTab({ place, enrich, enrichLoading }) {
  const m = place.meta ?? {}
  const website      = enrich?.website ?? m.website
  const phone        = enrich?.phone   ?? m.phone
  const cuisine      = m.cuisine
  const cleanWebsite = website ? website.replace(/^https?:\/\//, '').replace(/\/$/, '') : null

  return (
    <div className="flex-1 overflow-y-auto min-h-0">

      {/* Rating + status */}
      {enrichLoading ? (
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          {[0, 100, 200].map(d => (
            <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ background: '#333', animationDelay: `${d}ms` }} />
          ))}
          <span className="font-mono text-[10px]" style={{ color: '#555' }}>Buscant informació…</span>
        </div>
      ) : enrich && (enrich.rating != null || enrich.is_open_now != null || enrich.price) ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 pt-3 pb-2 flex items-center gap-3 flex-wrap"
          style={{ borderBottom: '1px solid #1A1A1A' }}
        >
          {enrich.rating != null && <StarRating rating={enrich.rating} />}
          {enrich.price && (
            <span className="font-mono text-[11px]" style={{ color: '#555' }}>{enrich.price}</span>
          )}
          {enrich.is_open_now != null && (
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-0.5 rounded"
              style={{
                color:      enrich.is_open_now ? C.green : C.red,
                background: enrich.is_open_now ? `${C.green}18` : `${C.red}18`,
                border:     `1px solid ${enrich.is_open_now ? C.green : C.red}44`,
              }}>
              {enrich.is_open_now ? 'Obert ara' : 'Tancat'}
            </span>
          )}
        </motion.div>
      ) : null}

      {/* Description */}
      {enrich?.description && !enrichLoading && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-4 py-3 font-mono text-[11px] leading-relaxed"
          style={{ color: '#888', borderBottom: '1px solid #1A1A1A' }}
        >
          {enrich.description}
        </motion.p>
      )}

      {/* Meta info */}
      <div className="px-4 py-2">
        {cuisine && (
          <MetaRow icon={Icons.restaurant}>
            <span className="capitalize">{cuisine.replace(/_/g, ' · ')}</span>
          </MetaRow>
        )}
        {phone && <MetaRow icon={Icons.phone} href={`tel:${phone}`}>{phone}</MetaRow>}
        {cleanWebsite && (
          <MetaRow icon={Icons.globe} href={website}>
            <span className="flex items-center gap-1">
              {cleanWebsite}
              <Icons.external size={9} />
            </span>
          </MetaRow>
        )}
        {m.distance_m != null && (
          <MetaRow icon={Icons.crosshair}>
            {m.distance_m < 1000 ? `${m.distance_m} m` : `${(m.distance_m / 1000).toFixed(1)} km`}
          </MetaRow>
        )}
        {m.wheelchair === 'yes' && (
          <MetaRow icon={Icons.check}><span style={{ color: C.green }}>Accessible</span></MetaRow>
        )}
      </div>

      {enrich?.wiki_url && (
        <div className="px-4 pb-3" style={{ borderTop: '1px solid #1A1A1A' }}>
          <a href={enrich.wiki_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors"
            style={{ color: '#555' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#888' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#555' }}>
            <Icons.external size={9} />
            Veure a Wikipedia
          </a>
        </div>
      )}
    </div>
  )
}

/* ── Tab: Horaris ───────────────────────────────────────────────────────── */

function HorarisTab({ place, enrich, enrichLoading }) {
  const hours = enrich?.hours ?? place.meta?.opening_hours

  if (enrichLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[0, 140, 280].map(d => (
              <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ background: '#E8622A', animationDelay: `${d}ms` }} />
            ))}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: '#555' }}>
            Buscant horaris…
          </span>
        </div>
      </div>
    )
  }

  if (!hours) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#1C1C1C', color: '#555' }}>
          <Icons.clock size={16} />
        </div>
        <p className="font-syne text-[13px]" style={{ color: '#888' }}>Horari no disponible</p>
        <p className="font-mono text-[10px]" style={{ color: '#555' }}>No tenim dades d'horari per a aquest lloc</p>
      </div>
    )
  }

  // Parse "Mo-Fr 09:00-20:00; Sa 09:00-14:00" style or plain text
  const lines = typeof hours === 'string'
    ? hours.split(';').map(s => s.trim()).filter(Boolean)
    : []

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="px-4 pt-3 pb-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] mb-3" style={{ color: '#555' }}>Horari d'obertura</p>

        {enrich?.is_open_now != null && (
          <div className="mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: enrich.is_open_now ? C.green : C.red,
                       boxShadow: `0 0 6px ${enrich.is_open_now ? C.green : C.red}` }} />
            <span className="font-syne text-[13px] font-medium"
              style={{ color: enrich.is_open_now ? C.green : C.red }}>
              {enrich.is_open_now ? 'Obert ara' : 'Tancat ara'}
            </span>
          </div>
        )}

        {lines.length > 0 ? (
          <div className="flex flex-col" style={{ borderRadius: 6, border: '1px solid #262626', overflow: 'hidden' }}>
            {lines.map((line, i) => (
              <div key={i} className="px-3 py-2 font-mono text-[11px]"
                style={{ color: '#888', borderBottom: i < lines.length - 1 ? '1px solid #1A1A1A' : 'none' }}>
                {line}
              </div>
            ))}
          </div>
        ) : (
          <p className="font-mono text-[11px] leading-relaxed" style={{ color: '#888' }}>{hours}</p>
        )}
      </div>
    </div>
  )
}

/* ── Tab: Com arribar-hi ────────────────────────────────────────────────── */

const ROUTE_MODES = [
  { id: 'foot',   label: 'A peu',  color: '#ffffff' },
  { id: 'bicing', label: 'Bicing', color: '#E8622A' },
  { id: 'metro',  label: 'Metro',  color: '#ff6b35' },
  { id: 'bus',    label: 'Bus',    color: '#00b4ff' },
  { id: 'car',    label: 'Cotxe',  color: '#C98E2E' },
]

function RutaTab({ place, onRoute }) {
  const [selectedMode, setSelectedMode] = useState('foot')

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] mb-2.5" style={{ color: '#555' }}>Mode de transport</p>
        <div className="grid grid-cols-5 gap-1">
          {ROUTE_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedMode(m.id)}
              className="py-2 flex flex-col items-center gap-1 transition-all"
              style={{
                borderRadius: 6,
                border: `1px solid ${selectedMode === m.id ? m.color + '55' : '#262626'}`,
                background: selectedMode === m.id ? '#1C1C1C' : 'transparent',
              }}
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.08em]"
                style={{ color: selectedMode === m.id ? m.color : '#555' }}>
                {m.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #1A1A1A' }}>
        <div className="p-3 rounded-lg" style={{ background: '#1C1C1C', border: '1px solid #262626' }}>
          <p className="font-mono text-[10px]" style={{ color: '#555' }}>Destí</p>
          <p className="font-syne text-[13px] font-medium mt-0.5 truncate" style={{ color: '#EBEBEB' }}>{place.name}</p>
          {place.address && (
            <p className="font-mono text-[10px] mt-0.5 truncate" style={{ color: '#555' }}>{place.address}</p>
          )}
        </div>
      </div>

      <div className="flex-1" />

      <div className="px-4 pb-4 flex-shrink-0">
        <button
          onClick={() => onRoute(selectedMode)}
          className="w-full h-11 flex items-center justify-center gap-2 font-syne text-[13px] font-semibold transition-all active:scale-[0.98]"
          style={{ borderRadius: 6, background: '#E8622A', border: '1px solid #E8622A', color: '#fff' }}
        >
          <Icons.route size={14} style={{ color: '#fff' }} />
          Calcular ruta
        </button>
      </div>
    </div>
  )
}

/* ── Beach body ─────────────────────────────────────────────────────────── */

function BeachBody({ place }) {
  const b = place.meta ?? {}
  const flagColor = FLAG_COLOR[b.flag] ?? '#888'
  const occColor  = OCC_COLOR[b.occupancy_level] ?? '#888'

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      {/* Stats grid */}
      <div className="px-4 pt-3 pb-3 grid grid-cols-3 gap-2" style={{ borderBottom: '1px solid #1A1A1A' }}>
        <DataRow label="Aire"  value={`${b.weather?.temp ?? '—'}°`} color="#EBEBEB" />
        <DataRow label="Aigua" value={`${b.water_temp ?? '—'}°`}    color={C.blue} />
        <DataRow label="Afluència" value={`${b.occupancy_pct ?? '—'}%`} color={occColor} />
      </div>

      {/* Flag + occupancy */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid #1A1A1A' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: flagColor }} />
          <span className="font-syne text-[12px] font-medium" style={{ color: '#EBEBEB' }}>
            {FLAG_LABEL[b.flag] ?? b.flag}
          </span>
          {b.flag_reason && <span className="font-mono text-[10px]" style={{ color: '#555' }}>· {b.flag_reason}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] w-24" style={{ color: '#888' }}>{OCC_LABEL[b.occupancy_level]}</span>
          <div className="flex-1 h-[2px] rounded-full" style={{ background: '#262626' }}>
            <div className="h-full rounded-full" style={{ width: `${b.occupancy_pct}%`, background: occColor }} />
          </div>
        </div>
      </div>

      {/* Amenities */}
      {b.amenities?.length > 0 && (
        <div className="px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] mb-2" style={{ color: '#555' }}>Serveis</p>
          <div className="flex flex-wrap gap-1.5">
            {b.amenities.map(a => (
              <span key={a} className="font-mono text-[9px] px-2 py-1 uppercase tracking-[0.08em]"
                style={{ borderRadius: 4, background: '#1C1C1C', border: '1px solid #262626', color: '#888' }}>
                {a === 'lifeguard' ? 'socorrista' : a === 'showers' ? 'dutxes' : a === 'accessible' ? 'accessible' : a}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Pin body ───────────────────────────────────────────────────────────── */

function PinBody({ place }) {
  return (
    <div className="flex-1 px-4 py-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] mb-2" style={{ color: '#555' }}>Coordenades</p>
      <p className="font-mono text-[12px] tabular-nums" style={{ color: '#888' }}>
        {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
      </p>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function PlaceView() {
  const place        = useDrawerStore(s => s.place)
  const back         = useDrawerStore(s => s.back)
  const close        = useDrawerStore(s => s.close)
  const userLocation = useMapStore(s => s.userLocation)
  const [tab,    setTab]    = useState('info')
  const [copied, setCopied] = useState(false)

  const { data: enrich, loading: enrichLoading } = usePlaceEnrich(place)

  // Reset tab when place changes
  useEffect(() => { setTab('info') }, [place?.id])

  if (!place) return null

  const handleRoute = (mode = 'foot') => {
    const { setDestination, setOrigin, setMode, setChatRequest } = useRouteStore.getState()
    const origin      = userLocation ? { ...userLocation, label: 'La meva ubicació' } : null
    const destination = { lat: place.lat, lng: place.lng, label: place.name }
    setMode(mode)
    if (origin) setOrigin(origin)
    setDestination(destination)
    setChatRequest({ origin, destination, mode, route: null })
    close()
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(`${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const catId  = place.category?.id ?? 'attraction'
  const accent = POI_CATEGORY_COLORS[catId] ?? '#8b5cf6'

  const subtitle = place.kind === 'beach'
    ? [place.meta?.district, place.meta?.length_m ? `${place.meta.length_m}m` : null].filter(Boolean).join(' · ')
    : place.kind === 'poi' ? (place.address ?? null)
    : place.address ?? `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`

  const showTabs = place.kind === 'poi'

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Hero */}
      {place.kind === 'poi' && (
        <PlaceHero photos={enrich?.photos} category={place.category} />
      )}

      {/* Title block */}
      <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2.5 flex-shrink-0"
        style={{ borderBottom: showTabs ? 'none' : '1px solid #262626' }}>
        <div className="min-w-0 flex-1">
          {place.kind === 'poi' && (
            <button onClick={back}
              className="flex items-center gap-1 mb-1.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors"
              style={{ color: '#555' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#888' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555' }}>
              ← Tornar
            </button>
          )}
          <h2 className="font-syne text-[15px] font-semibold leading-tight" style={{ color: '#EBEBEB' }}>
            {place.name}
          </h2>
          {place.kind === 'poi' && place.category?.label && (
            <span className="inline-block mt-1 font-mono text-[8px] uppercase tracking-[0.1em] px-1.5 py-0.5"
              style={{ color: accent, background: `${accent}18`, borderRadius: 3, border: `1px solid ${accent}30` }}>
              {place.category.label}
            </span>
          )}
          {subtitle && (
            <p className="font-mono text-[10px] mt-1.5 truncate" style={{ color: '#555' }}>{subtitle}</p>
          )}
        </div>
        <button onClick={close}
          className="w-7 h-7 flex items-center justify-center rounded-md transition-colors flex-shrink-0"
          style={{ color: '#555' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#EBEBEB' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#555' }}>
          <Icons.close size={12} />
        </button>
      </div>

      {/* Tabs (POI only) */}
      {showTabs && (
        <TabBar active={tab} onChange={setTab} />
      )}

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          {/* POI tabs */}
          {showTabs && tab === 'info' && (
            <InfoTab place={place} enrich={enrich} enrichLoading={enrichLoading} />
          )}
          {showTabs && tab === 'horaris' && (
            <HorarisTab place={place} enrich={enrich} enrichLoading={enrichLoading} />
          )}
          {showTabs && tab === 'ruta' && (
            <RutaTab place={place} onRoute={handleRoute} />
          )}

          {/* Non-POI content */}
          {place.kind === 'beach' && <BeachBody place={place} />}
          {place.kind === 'pin'   && <PinBody   place={place} />}
        </motion.div>
      </AnimatePresence>

      {/* Action bar — hide when ruta tab active (it has its own CTA) */}
      {!(showTabs && tab === 'ruta') && (
        <div className="px-4 pt-2 pb-3.5 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid #1A1A1A' }}>
          <button onClick={() => showTabs ? setTab('ruta') : handleRoute()}
            className="flex-1 h-10 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{ borderRadius: 6, background: '#E8622A', border: '1px solid #E8622A' }}>
            <Icons.navigation size={13} style={{ color: '#fff' }} />
            <span className="font-syne text-[12px] font-semibold" style={{ color: '#fff' }}>Porta'm aquí</span>
          </button>
          
          {(enrich?.website || place.meta?.website) && (
            <a href={enrich?.website || place.meta?.website} target="_blank" rel="noopener noreferrer"
              className="flex-1 h-10 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              style={{ borderRadius: 6, background: '#1C1C1C', border: '1px solid #262626', color: '#EBEBEB' }}>
              <Icons.external size={12} />
              <span className="font-syne text-[12px] font-medium">Entrades / Web</span>
            </a>
          )}

          {!(enrich?.website || place.meta?.website) && (
            <button onClick={handleCopy}
              className="h-10 px-3 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              style={{ borderRadius: 6, background: '#1C1C1C', border: `1px solid ${copied ? '#E8622A' : '#262626'}`, color: copied ? '#E8622A' : '#555' }}>
              <Icons.copy size={12} />
              <span className="font-mono text-[9px] uppercase tracking-[0.08em]">{copied ? 'Copiat' : 'Coords'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
