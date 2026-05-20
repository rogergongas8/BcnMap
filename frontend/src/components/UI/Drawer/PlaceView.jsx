import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icons, POI_CATEGORY_COLORS } from '../icons'
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

const CATEGORY_ICONS = {
  restaurant: Icons.restaurant, cafe: Icons.cafe, bar: Icons.bar,
  bakery: Icons.bakery, supermarket: Icons.supermarket, pharmacy: Icons.pharmacy,
  hospital: Icons.hospital, bank: Icons.bank, museum: Icons.museum,
  attraction: Icons.attraction, monument: Icons.monument, hotel: Icons.hotel,
}

/* ── Small helpers ──────────────────────────────────────────────────────── */

function MetaRow({ icon: Icon, children }) {
  if (!children) return null
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="text-white/30 mt-0.5 flex-shrink-0"><Icon size={13} /></span>
      <span className="text-white/70 text-[12px] leading-snug min-w-0 break-words">{children}</span>
    </div>
  )
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
      <span className="text-white/85 text-[13px] font-semibold tabular-nums">{rating.toFixed(1)}</span>
    </div>
  )
}

const StarFull  = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="#fbbf24"><path d="M6 1l1.4 2.8 3.1.45-2.25 2.2.53 3.1L6 8.1 3.22 9.55l.53-3.1L1.5 4.25l3.1-.45z"/></svg>
const StarHalf  = () => <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1l1.4 2.8 3.1.45-2.25 2.2.53 3.1L6 8.1V1z" fill="#fbbf24"/><path d="M6 1L4.6 3.8l-3.1.45 2.25 2.2-.53 3.1L6 8.1V1z" fill="rgba(255,255,255,0.1)"/></svg>
const StarEmpty = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="rgba(255,255,255,0.12)"><path d="M6 1l1.4 2.8 3.1.45-2.25 2.2.53 3.1L6 8.1 3.22 9.55l.53-3.1L1.5 4.25l3.1-.45z"/></svg>

/* ── Photo / Hero ───────────────────────────────────────────────────────── */

function PlaceHero({ photos, category }) {
  const [idx, setIdx]       = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  const showPhoto = photos?.length > 0 && !imgError
  const catId     = category?.id ?? 'attraction'
  const accent    = POI_CATEGORY_COLORS[catId] ?? '#8b5cf6'
  const CatIcon   = CATEGORY_ICONS[catId] ?? Icons.pin

  if (!showPhoto) {
    return (
      <div
        className="relative w-full h-[130px] flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${accent}22 0%, ${accent}08 100%)` }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: `${accent}18`, boxShadow: `0 0 40px ${accent}30` }}
        >
          <span style={{ color: accent, opacity: 0.9 }}>
            <CatIcon size={32} />
          </span>
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${accent}12 0%, transparent 70%)`,
          }}
        />
      </div>
    )
  }

  return (
    <div className="relative w-full h-[160px] bg-white/[0.03] overflow-hidden flex-shrink-0">
      <AnimatePresence mode="wait">
        <motion.img
          key={photos[idx]}
          src={photos[idx]}
          alt=""
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: loaded ? 1 : 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onLoad={() => setLoaded(true)}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c10]/70 via-transparent to-transparent pointer-events-none" />
      {photos.length > 1 && (
        <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIdx(i); setLoaded(false) }}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white scale-125' : 'bg-white/40'}`}
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

/* ── POI body ───────────────────────────────────────────────────────────── */

function PoiBody({ place, enrich, enrichLoading }) {
  const m = place.meta ?? {}
  const website      = enrich?.website      ?? m.website
  const phone        = enrich?.phone        ?? m.phone
  const hours        = enrich?.hours        ?? m.opening_hours
  const cuisine      = m.cuisine
  const cleanWebsite = website ? website.replace(/^https?:\/\//, '').replace(/\/$/, '') : null

  const catId  = place.category?.id ?? 'attraction'
  const accent = POI_CATEGORY_COLORS[catId] ?? '#8b5cf6'

  return (
    <div className="flex-1 overflow-y-auto min-h-0">

      {/* Rating / status bar */}
      {enrichLoading ? (
        <div className="mx-4 mt-3 mb-2 flex items-center gap-2">
          {[0, 100, 200].map(d => (
            <span key={d} className="w-1.5 h-1.5 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
          <span className="text-white/25 text-[11px]">Buscando info…</span>
        </div>
      ) : enrich && (enrich.rating != null || enrich.is_open_now != null || enrich.price) ? (
        <motion.div
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mx-4 mt-3 mb-1 flex items-center gap-3 flex-wrap"
        >
          {enrich.rating != null && <StarRating rating={enrich.rating} />}
          {enrich.price && (
            <span className="text-white/45 text-[12px] tracking-wider">{enrich.price}</span>
          )}
          {enrich.is_open_now != null && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
              enrich.is_open_now
                ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/20'
                : 'text-rose-300 bg-rose-500/15 border border-rose-500/20'
            }`}>
              {enrich.is_open_now ? 'Abierto ahora' : 'Cerrado'}
            </span>
          )}
        </motion.div>
      ) : null}

      {/* Description */}
      {enrich?.description && !enrichLoading && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="mx-4 mt-2 mb-1 text-white/50 text-[12px] leading-relaxed line-clamp-3"
        >
          {enrich.description}
        </motion.p>
      )}

      {/* Divider */}
      <div className="mx-4 mt-3 mb-1 border-t border-white/[0.05]" />

      {/* Info rows */}
      <div className="px-4 py-1">
        {cuisine && (
          <MetaRow icon={Icons.restaurant}>
            <span className="capitalize">{cuisine.replace(/_/g, ' · ')}</span>
          </MetaRow>
        )}
        {hours && <MetaRow icon={Icons.clock}>{hours}</MetaRow>}
        {phone && (
          <MetaRow icon={Icons.phone}>
            <a href={`tel:${phone}`} className="hover:text-white transition-colors">{phone}</a>
          </MetaRow>
        )}
        {cleanWebsite && (
          <MetaRow icon={Icons.globe}>
            <a href={website} target="_blank" rel="noreferrer"
               className="hover:text-white transition-colors inline-flex items-center gap-1.5">
              {cleanWebsite}
              <Icons.external size={10} />
            </a>
          </MetaRow>
        )}
        {m.distance_m != null && (
          <MetaRow icon={Icons.crosshair}>
            {m.distance_m < 1000 ? `${m.distance_m} m` : `${(m.distance_m / 1000).toFixed(1)} km`}
          </MetaRow>
        )}
        {m.wheelchair === 'yes' && (
          <MetaRow icon={Icons.check}><span className="text-emerald-400/80">Accesible</span></MetaRow>
        )}
      </div>

      {/* Wikipedia link */}
      {enrich?.wiki_url && (
        <div className="px-4 pt-1 pb-2">
          <a href={enrich.wiki_url} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 text-[10px] text-white/25 hover:text-white/55 transition-colors">
            <Icons.external size={10} />
            Ver en Wikipedia
          </a>
        </div>
      )}

      {enrich?.sources?.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-white/12 text-[9px]">Fuentes: {enrich.sources.join(' · ')}</p>
        </div>
      )}
    </div>
  )
}

/* ── Beach body ─────────────────────────────────────────────────────────── */

function BeachBody({ place }) {
  const b = place.meta ?? {}
  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="px-4 py-3 border-t border-white/[0.05] grid grid-cols-3 gap-2">
        {[
          { label: 'Aire', value: `${b.weather?.temp ?? '—'}°` },
          { label: 'Agua', value: `${b.water_temp ?? '—'}°` },
          { label: 'Aforo', value: `${b.occupancy_pct}%`, cls: OCC_TEXT[b.occupancy_level] ?? 'text-white' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <p className="text-white/35 text-[9px] uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-[15px] tabular-nums font-medium ${cls ?? 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-white/[0.05]">
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-1.5 h-1.5 rounded-full ${FLAG_DOT[b.flag] ?? 'bg-white/40'}`} />
          <span className="text-white/85 text-[12px]">{FLAG_LABEL[b.flag] ?? b.flag}</span>
          {b.flag_reason && <span className="text-white/35 text-[11px]">· {b.flag_reason}</span>}
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-white/55 text-[11px] flex-shrink-0 w-16">{OCC_LABEL[b.occupancy_level]}</span>
          <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
            <div className={`h-full ${OCC_BAR[b.occupancy_level] ?? 'bg-white/30'} transition-all`}
                 style={{ width: `${b.occupancy_pct}%` }} />
          </div>
          <span className="text-white/55 text-[11px] tabular-nums w-9 text-right">{b.occupancy_pct}%</span>
        </div>
      </div>
      {b.amenities?.length > 0 && (
        <div className="px-4 py-3 border-t border-white/[0.05]">
          <p className="text-white/30 text-[10px] uppercase tracking-[0.15em] mb-2.5">Servicios</p>
          <div className="flex flex-wrap gap-1.5">
            {b.amenities.map(a => (
              <span key={a} className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-white/65 text-[10px] capitalize">
                {a === 'lifeguard' ? 'socorrista' : a === 'showers' ? 'duchas' : a === 'accessible' ? 'accesible' : a}
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
    <div className="flex-1 px-4 py-4 border-t border-white/[0.05]">
      <p className="text-white/30 text-[10px] uppercase tracking-[0.15em] mb-2">Coordenadas</p>
      <p className="text-white/70 text-[12px] font-mono tabular-nums">
        {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
      </p>
    </div>
  )
}

/* ── Action bar ─────────────────────────────────────────────────────────── */

function ActionBar({ onRoute, onCopy, copied }) {
  return (
    <div className="px-4 pt-2 pb-4 flex gap-2 flex-shrink-0 border-t border-white/[0.05]">
      <button
        onClick={onRoute}
        className="flex-1 h-10 rounded-xl bg-white text-black text-[12px] font-semibold tracking-wide
          flex items-center justify-center gap-2 hover:bg-white/90 active:scale-[0.98] transition-all"
      >
        <Icons.route size={14} />
        <span>Cómo llegar</span>
      </button>
      <button
        onClick={onCopy}
        className="h-10 px-3.5 rounded-xl bg-white/[0.05] border border-white/[0.07]
          text-white/60 hover:text-white hover:bg-white/[0.09] active:scale-[0.98]
          transition-all flex items-center justify-center gap-1.5 text-[11px]"
      >
        <Icons.copy size={13} />
        <span>{copied ? 'Copiado' : 'Coords'}</span>
      </button>
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

  const { data: enrich, loading: enrichLoading } = usePlaceEnrich(place)

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

  const catId  = place.category?.id ?? 'attraction'
  const accent = POI_CATEGORY_COLORS[catId] ?? '#8b5cf6'

  const subtitle = place.kind === 'beach'
    ? [place.meta?.district, place.meta?.length_m ? `${place.meta.length_m}m` : null].filter(Boolean).join(' · ')
    : place.kind === 'poi'
      ? place.address ?? null
      : place.address ?? `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Hero: photo carousel or category gradient */}
      {place.kind === 'poi' && (
        <PlaceHero photos={enrich?.photos} category={place.category} />
      )}

      {/* Back button (for POIs opened from nearby list) */}
      {place.kind === 'poi' && (
        <button
          onClick={back}
          className="px-4 pt-3 pb-1 flex items-center gap-1 text-white/40 hover:text-white/80
            text-[11px] tracking-wide transition-colors w-fit flex-shrink-0"
        >
          <Icons.chevronLeft size={13} />
          <span>Volver</span>
        </button>
      )}

      {/* Title block */}
      <div className={`flex items-start justify-between gap-3 px-4 pb-2 flex-shrink-0 ${place.kind === 'poi' ? 'pt-1' : 'pt-4'}`}>
        <div className="min-w-0 flex-1">
          <h2 className="text-white text-[17px] font-semibold leading-tight tracking-tight truncate">
            {place.name}
          </h2>
          {place.kind === 'poi' && place.category?.label && (
            <span
              className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ color: accent, background: `${accent}18` }}
            >
              {place.category.label}
            </span>
          )}
          {subtitle && (
            <p className="text-white/40 text-[11px] mt-1 leading-snug truncate">{subtitle}</p>
          )}
        </div>
        <button
          onClick={close}
          className="text-white/30 hover:text-white/80 transition-colors w-8 h-8 flex items-center
            justify-center rounded-xl hover:bg-white/[0.06] flex-shrink-0 mt-0.5"
        >
          <Icons.close size={15} />
        </button>
      </div>

      {/* Body */}
      {place.kind === 'poi'   && <PoiBody   place={place} enrich={enrich} enrichLoading={enrichLoading} />}
      {place.kind === 'beach' && <BeachBody place={place} />}
      {place.kind === 'pin'   && <PinBody   place={place} />}

      <ActionBar onRoute={handleRoute} onCopy={handleCopy} copied={copied} />
    </div>
  )
}
