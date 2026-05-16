import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icons } from '../icons'
import { useDrawerStore } from '../../../store/drawerStore'
import { useMapStore } from '../../../store/mapStore'
import { useRouteStore } from '../../../store/routeStore'
import { fetchPlaceEnrich } from '../../../services/api'

/* ── Constants ─────────────────────────────────────────────────────────── */

const FLAG_LABEL = { green: 'Bandera verde', yellow: 'Bandera amarilla', red: 'Bandera roja' }
const FLAG_DOT   = { green: 'bg-emerald-400', yellow: 'bg-amber-400', red: 'bg-rose-400' }
const OCC_LABEL  = { low: 'Poca afluencia', medium: 'Afluencia moderada', high: 'Mucha afluencia' }
const OCC_TEXT   = { low: 'text-emerald-300', medium: 'text-amber-300', high: 'text-rose-300' }
const OCC_BAR    = { low: 'bg-emerald-400', medium: 'bg-amber-400', high: 'bg-rose-400' }

/* ── Small helpers ──────────────────────────────────────────────────────── */

function MetaRow({ icon: Icon, children }) {
  if (!children) return null
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="text-white/35 mt-0.5 flex-shrink-0"><Icon size={13} /></span>
      <span className="text-white/75 text-[12px] leading-snug min-w-0 break-words">{children}</span>
    </div>
  )
}

function StarRating({ rating, total }) {
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
      <span className="text-white/80 text-[13px] font-medium tabular-nums">{rating.toFixed(1)}</span>
      {total != null && (
        <span className="text-white/35 text-[11px] tabular-nums">({total.toLocaleString()})</span>
      )}
    </div>
  )
}

const StarFull  = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="#fbbf24"><path d="M6 1l1.4 2.8 3.1.45-2.25 2.2.53 3.1L6 8.1 3.22 9.55l.53-3.1L1.5 4.25l3.1-.45z"/></svg>
const StarHalf  = () => <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1l1.4 2.8 3.1.45-2.25 2.2.53 3.1L6 8.1V1z" fill="#fbbf24"/><path d="M6 1L4.6 3.8l-3.1.45 2.25 2.2-.53 3.1L6 8.1V1z" fill="rgba(255,255,255,0.15)"/></svg>
const StarEmpty = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="rgba(255,255,255,0.15)"><path d="M6 1l1.4 2.8 3.1.45-2.25 2.2.53 3.1L6 8.1 3.22 9.55l.53-3.1L1.5 4.25l3.1-.45z"/></svg>

function OpenBadge({ isOpen }) {
  if (isOpen == null) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
      ${isOpen
        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
        : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
      }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      {isOpen ? 'Abierto ahora' : 'Cerrado'}
    </span>
  )
}

/* ── Photo carousel ─────────────────────────────────────────────────────── */

function PhotoCarousel({ photos }) {
  const [idx, setIdx] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (!photos?.length) return null

  return (
    <div className="relative w-full h-[180px] bg-white/[0.03] overflow-hidden flex-shrink-0">
      <AnimatePresence mode="wait">
        {!error ? (
          <motion.img
            key={photos[idx]}
            src={photos[idx]}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: loaded ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <Icons.photo size={32} />
          </div>
        )}
      </AnimatePresence>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c10]/80 via-transparent to-transparent pointer-events-none" />

      {/* Dot navigation */}
      {photos.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIdx(i); setLoaded(false); setError(false) }}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      )}

      {/* Foursquare attribution */}
      <span className="absolute top-2 right-2 text-[9px] text-white/30 font-mono">Foursquare</span>
    </div>
  )
}

/* ── Foursquare enrichment hook ─────────────────────────────────────────── */

function useFoursquareEnrich(place) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (place?.kind !== 'poi') { setData(null); return }

    let cancelled = false
    setData(null)
    setLoading(true)

    fetchPlaceEnrich(place.name, place.lat, place.lng)
      .then(res => {
        if (cancelled) return
        setData(res?.data ?? null)
      })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [place?.id])

  return { data, loading }
}

/* ── Shared sub-components ──────────────────────────────────────────────── */

function Header({ title, subtitle, onClose }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="text-white text-[17px] font-medium leading-tight">{title}</h2>
        {subtitle && (
          <p className="text-white/45 text-[11px] mt-1 leading-snug">{subtitle}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-white/35 hover:text-white/85 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.05] flex-shrink-0"
        aria-label="Cerrar"
      >
        <Icons.close size={16} />
      </button>
    </div>
  )
}

function ActionBar({ onRoute, onCopy, copied }) {
  return (
    <div className="px-4 pt-3 pb-4 flex gap-2 flex-shrink-0">
      <button
        onClick={onRoute}
        className="flex-1 h-10 rounded-xl bg-white text-black text-[12px] font-medium tracking-wide
          flex items-center justify-center gap-2 hover:bg-white/90 transition-colors"
      >
        <Icons.route size={14} />
        <span>Cómo llegar</span>
      </button>
      <button
        onClick={onCopy}
        className="h-10 px-3 rounded-xl bg-white/[0.05] border border-white/[0.07] text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center justify-center gap-2 text-[11px]"
        title="Copiar coordenadas"
      >
        <Icons.copy size={13} />
        <span>{copied ? 'Copiado' : 'Coords'}</span>
      </button>
    </div>
  )
}

/* ── POI body ───────────────────────────────────────────────────────────── */

function PoiBody({ place, fsq, fsqLoading }) {
  const m = place.meta ?? {}

  // Prefer Foursquare data, fall back to OSM
  const website      = fsq?.website      ?? m.website
  const phone        = fsq?.phone        ?? m.phone
  const hours        = fsq?.hours        ?? m.opening_hours
  const cuisine      = m.cuisine
  const cleanWebsite = website ? website.replace(/^https?:\/\//, '').replace(/\/$/, '') : null

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      {/* Foursquare enrichment card */}
      {fsqLoading && (
        <div className="mx-4 my-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center gap-2">
          <div className="flex gap-1">
            {[0, 120, 240].map(d => (
              <span key={d} className="w-1 h-1 bg-white/25 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
          <span className="text-white/30 text-[11px]">Cargando valoraciones…</span>
        </div>
      )}

      {fsq && !fsqLoading && (fsq.rating != null || fsq.is_open_now != null || fsq.description || fsq.price) && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mx-4 my-3 px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05]"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <StarRating rating={fsq.rating} total={fsq.total_ratings} />
            {fsq.price && (
              <span className="text-amber-400/80 text-[12px] font-mono flex-shrink-0">{fsq.price}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <OpenBadge isOpen={fsq.is_open_now} />
            {fsq.category && (
              <span className="text-white/35 text-[10px]">{fsq.category}</span>
            )}
          </div>
          {fsq.description && (
            <p className="text-white/45 text-[11px] leading-relaxed mt-2 line-clamp-2">{fsq.description}</p>
          )}
        </motion.div>
      )}

      {/* Foursquare link — shows when we have a FSQ record but limited data */}
      {fsq && !fsqLoading && fsq.foursquare_url && (
        <div className="mx-4 mb-2">
          <a
            href={fsq.foursquare_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/60 transition-colors"
          >
            <Icons.external size={10} />
            <span>Ver reseñas en Foursquare</span>
          </a>
        </div>
      )}

      {/* OSM info */}
      <div className="px-4 py-2 border-t border-white/[0.05]">
        <p className="text-white/25 text-[10px] uppercase tracking-[0.15em] mb-1">Información</p>
        <div className="flex flex-col">
          {cuisine && (
            <MetaRow icon={Icons.restaurant}>
              <span className="capitalize">{cuisine.replace(/_/g, ' · ')}</span>
            </MetaRow>
          )}
          <MetaRow icon={Icons.clock}>{hours}</MetaRow>
          <MetaRow icon={Icons.phone}>
            {phone && <a href={`tel:${phone}`} className="hover:text-white transition-colors">{phone}</a>}
          </MetaRow>
          <MetaRow icon={Icons.globe}>
            {cleanWebsite && (
              <a href={website} target="_blank" rel="noreferrer" className="hover:text-white transition-colors inline-flex items-center gap-1.5">
                {cleanWebsite}
                <Icons.external size={11} />
              </a>
            )}
          </MetaRow>
          {m.distance_m != null && (
            <MetaRow icon={Icons.crosshair}>
              <span>A {m.distance_m < 1000 ? `${m.distance_m} m` : `${(m.distance_m / 1000).toFixed(1)} km`}</span>
            </MetaRow>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Beach body ─────────────────────────────────────────────────────────── */

function BeachBody({ place }) {
  const b = place.meta ?? {}

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="px-4 py-3 border-t border-white/[0.05] grid grid-cols-3 gap-2">
        <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <p className="text-white/35 text-[9px] uppercase tracking-wider mb-1">Aire</p>
          <p className="text-white text-[15px] tabular-nums font-medium">{b.weather?.temp ?? '—'}°</p>
        </div>
        <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <p className="text-white/35 text-[9px] uppercase tracking-wider mb-1">Agua</p>
          <p className="text-white text-[15px] tabular-nums font-medium">{b.water_temp ?? '—'}°</p>
        </div>
        <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <p className="text-white/35 text-[9px] uppercase tracking-wider mb-1">Aforo</p>
          <p className={`text-[15px] tabular-nums font-medium ${OCC_TEXT[b.occupancy_level] ?? 'text-white'}`}>
            {b.occupancy_pct}%
          </p>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-white/[0.05]">
        <p className="text-white/30 text-[10px] uppercase tracking-[0.15em] mb-3">Estado</p>
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-1.5 h-1.5 rounded-full ${FLAG_DOT[b.flag] ?? 'bg-white/40'}`} />
          <span className="text-white/85 text-[12px]">{FLAG_LABEL[b.flag] ?? b.flag}</span>
          <span className="text-white/35 text-[11px]">· {b.flag_reason}</span>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-white/55 text-[11px] flex-shrink-0 w-16">{OCC_LABEL[b.occupancy_level]}</span>
          <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className={`h-full ${OCC_BAR[b.occupancy_level] ?? 'bg-white/30'} transition-all`}
              style={{ width: `${b.occupancy_pct}%` }}
            />
          </div>
          <span className="text-white/55 text-[11px] tabular-nums w-9 text-right">{b.occupancy_pct}%</span>
        </div>
        <p className="text-white/30 text-[10px] leading-relaxed">
          Aforo estimado a partir de hora, día, clima y popularidad. No hay sensor público.
        </p>
      </div>

      {b.amenities?.length > 0 && (
        <div className="px-4 py-3 border-t border-white/[0.05]">
          <p className="text-white/30 text-[10px] uppercase tracking-[0.15em] mb-2.5">Servicios</p>
          <div className="flex flex-wrap gap-1.5">
            {b.amenities.map(a => (
              <span key={a} className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-white/65 text-[10px] capitalize">
                {a === 'lifeguard' ? 'socorrista' : a === 'showers' ? 'duchas' : a === 'accessible' ? 'accesible' : a === 'wifi' ? 'wifi' : a}
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
    <div className="flex-1 px-4 py-3 border-t border-white/[0.05]">
      <p className="text-white/30 text-[10px] uppercase tracking-[0.15em] mb-2">Coordenadas</p>
      <p className="text-white/70 text-[12px] tabular-nums">
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
  const [copied, setCopied] = React.useState(false)

  const { data: fsq, loading: fsqLoading } = useFoursquareEnrich(place)

  if (!place) return null

  const handleRoute = () => {
    const { setDestination, setOrigin, setMode, setChatRequest } = useRouteStore.getState()
    const origin      = userLocation ? { ...userLocation, label: 'Mi ubicación' } : null
    const destination = { lat: place.lat, lng: place.lng, label: place.name }
    setMode('foot')
    if (origin) setOrigin(origin)
    setDestination(destination)
    setChatRequest({ origin, destination, mode: 'foot', route: null })
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(`${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const subtitle = place.kind === 'beach'
    ? `${place.meta?.district ?? ''} · ${place.meta?.length_m ?? ''}m`
    : place.kind === 'poi'
      ? `${place.category?.label ?? ''}${place.address ? ' · ' + place.address : ''}`
      : place.address || `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back button for POIs */}
      {place.kind === 'poi' && (
        <button
          onClick={back}
          className="px-4 pt-3 pb-0 flex items-center gap-1.5 text-white/45 hover:text-white text-[11px] transition-colors w-fit flex-shrink-0"
        >
          <Icons.chevronLeft size={14} />
          <span>Volver</span>
        </button>
      )}

      {/* Photo carousel — only for POIs with Foursquare photos */}
      {place.kind === 'poi' && fsq?.photos?.length > 0 && (
        <PhotoCarousel photos={fsq.photos} />
      )}

      <Header title={place.name} subtitle={subtitle} onClose={close} />

      {place.kind === 'poi'   && <PoiBody   place={place} fsq={fsq} fsqLoading={fsqLoading} />}
      {place.kind === 'beach' && <BeachBody place={place} />}
      {place.kind === 'pin'   && <PinBody   place={place} />}

      <ActionBar onRoute={handleRoute} onCopy={handleCopy} copied={copied} />
    </div>
  )
}
