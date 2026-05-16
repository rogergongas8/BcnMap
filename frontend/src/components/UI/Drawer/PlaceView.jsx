import React from 'react'
import { Icons } from '../icons'
import { useDrawerStore } from '../../../store/drawerStore'
import { useMapStore } from '../../../store/mapStore'
import { useRouteStore } from '../../../store/routeStore'

const FLAG_LABEL = { green: 'Bandera verde', yellow: 'Bandera amarilla', red: 'Bandera roja' }
const FLAG_DOT   = { green: 'bg-emerald-400', yellow: 'bg-amber-400', red: 'bg-rose-400' }
const OCC_LABEL  = { low: 'Poca afluencia', medium: 'Afluencia moderada', high: 'Mucha afluencia' }
const OCC_TEXT   = { low: 'text-emerald-300', medium: 'text-amber-300', high: 'text-rose-300' }
const OCC_BAR    = { low: 'bg-emerald-400', medium: 'bg-amber-400', high: 'bg-rose-400' }

function MetaRow({ icon: Icon, children }) {
  if (!children) return null
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="text-white/35 mt-0.5 flex-shrink-0"><Icon size={13} /></span>
      <span className="text-white/75 text-[12px] leading-snug min-w-0 break-words">{children}</span>
    </div>
  )
}

function Header({ title, subtitle, onClose }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="text-white text-[17px] font-medium leading-tight">{title}</h2>
        {subtitle && (
          <p className="text-white/45 text-[11px] mt-1 leading-snug truncate">{subtitle}</p>
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
    <div className="px-4 pt-3 pb-4 flex gap-2">
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

function PoiBody({ place }) {
  const m = place.meta ?? {}
  const cleanWebsite = m.website ? m.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : null

  return (
    <div className="px-4 py-3 border-t border-white/[0.05]">
      <p className="text-white/30 text-[10px] uppercase tracking-[0.15em] mb-2">Información</p>
      <div className="flex flex-col">
        {m.cuisine && (
          <MetaRow icon={Icons.restaurant}>
            <span className="capitalize">{m.cuisine.replace(/_/g, ' · ')}</span>
          </MetaRow>
        )}
        <MetaRow icon={Icons.clock}>{m.opening_hours}</MetaRow>
        <MetaRow icon={Icons.phone}>
          {m.phone && <a href={`tel:${m.phone}`} className="hover:text-white transition-colors">{m.phone}</a>}
        </MetaRow>
        <MetaRow icon={Icons.globe}>
          {cleanWebsite && (
            <a href={m.website} target="_blank" rel="noreferrer" className="hover:text-white transition-colors inline-flex items-center gap-1.5">
              {cleanWebsite}
              <Icons.external size={11} />
            </a>
          )}
        </MetaRow>
        {m.distance_m != null && (
          <MetaRow icon={Icons.crosshair}>
            <span>A {m.distance_m < 1000 ? `${m.distance_m} m` : `${(m.distance_m/1000).toFixed(1)} km`}</span>
          </MetaRow>
        )}
      </div>
    </div>
  )
}

function BeachBody({ place }) {
  const b = place.meta ?? {}

  return (
    <>
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
                {a === 'lifeguard' ? 'socorrista'
                  : a === 'showers' ? 'duchas'
                  : a === 'accessible' ? 'accesible'
                  : a === 'wifi' ? 'wifi'
                  : a}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function PinBody({ place }) {
  return (
    <div className="px-4 py-3 border-t border-white/[0.05]">
      <p className="text-white/30 text-[10px] uppercase tracking-[0.15em] mb-2">Coordenadas</p>
      <p className="text-white/70 text-[12px] tabular-nums">
        {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
      </p>
    </div>
  )
}

export default function PlaceView() {
  const place = useDrawerStore(s => s.place)
  const back  = useDrawerStore(s => s.back)
  const close = useDrawerStore(s => s.close)
  const userLocation = useMapStore(s => s.userLocation)
  const [copied, setCopied] = React.useState(false)

  if (!place) return null

  const handleRoute = () => {
    const { setDestination, setOrigin, setMode, setChatRequest } = useRouteStore.getState()
    const origin = userLocation ? { ...userLocation, label: 'Mi ubicación' } : null
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

  const showBack = place.kind === 'poi'

  return (
    <div className="flex flex-col h-full">
      {showBack && (
        <button
          onClick={back}
          className="px-4 pt-4 pb-1 flex items-center gap-1.5 text-white/45 hover:text-white text-[11px] transition-colors w-fit"
        >
          <Icons.chevronLeft size={14} />
          <span>Volver</span>
        </button>
      )}

      <Header title={place.name} subtitle={subtitle} onClose={close} />

      {place.kind === 'poi'   && <PoiBody   place={place} />}
      {place.kind === 'beach' && <BeachBody place={place} />}
      {place.kind === 'pin'   && <PinBody   place={place} />}

      <div className="mt-auto">
        <ActionBar onRoute={handleRoute} onCopy={handleCopy} copied={copied} />
      </div>
    </div>
  )
}
