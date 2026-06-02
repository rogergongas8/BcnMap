import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../icons'
import { useAuthStore } from '../../../store/authStore'
import { useRouteStore } from '../../../store/routeStore'
import { useMapStore } from '../../../store/mapStore'
import { useDrawerStore } from '../../../store/drawerStore'
import {
  fetchFavorites, addFavorite, deleteFavorite,
  fetchSavedRoutes, addSavedRoute, deleteSavedRoute,
} from '../../../services/api'
import CommuteView from './CommuteView'

const TAB = { favs: 'favs', routes: 'routes', commutes: 'commutes' }

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="px-6 py-12 flex flex-col items-center text-center gap-2">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#211F1B', color: '#8C8884' }}>
        <Icon size={15} />
      </div>
      <p className="font-syne text-[13px] leading-snug max-w-[200px]" style={{ color: '#B0ACA7' }}>{text}</p>
    </div>
  )
}

function FavRow({ fav, onDelete, onSelect }) {
  return (
    <li
      onClick={() => onSelect(fav)}
      className="flex cursor-pointer transition-colors group"
      style={{ borderBottom: '1px solid #201E1B' }}
    >
      <div className="w-[3px] flex-shrink-0 self-stretch group-hover:bg-[#B8885A] transition-colors" />
      <div className="flex items-start gap-3 px-3.5 py-3 flex-1 min-w-0">
        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: '#2C2926', color: '#B0ACA7' }}>
          <Icons.pin size={12} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-syne text-[13px] font-medium truncate" style={{ color: '#F7F6F4' }}>{fav.name}</p>
          {fav.address && (
            <p className="font-mono text-[10px] truncate mt-0.5" style={{ color: '#8C8884' }}>{fav.address}</p>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(fav.id) }}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded flex-shrink-0"
          style={{ color: '#8C8884' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#D45555' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8C8884' }}
        >
          <Icons.close size={10} />
        </button>
      </div>
    </li>
  )
}

function RouteRow({ route, onDelete, onLoad }) {
  const modeColor = { foot: '#ffffff', bicing: '#00ff88', bus: '#ff6b35', car: '#ffaa00' }
  const color = modeColor[route.mode] ?? '#B0ACA7'

  return (
    <li
      onClick={() => onLoad(route)}
      className="flex cursor-pointer transition-colors group"
      style={{ borderBottom: '1px solid #201E1B' }}
    >
      <div className="w-[3px] flex-shrink-0 self-stretch group-hover:bg-[#B8885A] transition-colors" />
      <div className="flex items-start gap-3 px-3.5 py-3 flex-1 min-w-0">
        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 font-mono text-[9px] font-bold" style={{ background: color + '18', color, border: `1px solid ${color}33` }}>
          {route.mode === 'foot' ? 'PE' : route.mode === 'bicing' ? 'BC' : route.mode === 'metro' ? 'ME' : route.mode === 'bus' ? 'BU' : 'CO'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-syne text-[13px] font-medium truncate" style={{ color: '#F7F6F4' }}>{route.name ?? route.to_label}</p>
          <p className="font-mono text-[10px] truncate mt-0.5" style={{ color: '#8C8884' }}>
            {route.from_label} → {route.to_label}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(route.id) }}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded flex-shrink-0"
          style={{ color: '#8C8884' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#D45555' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8C8884' }}
        >
          <Icons.close size={10} />
        </button>
      </div>
    </li>
  )
}

export default function SavedView() {
  const { t } = useTranslation()
  const isLogged = useAuthStore(s => s.isLogged)
  const [tab,      setTab]      = useState(TAB.favs)
  const [favs,     setFavs]     = useState([])
  const [routes,   setRoutes]   = useState([])
  const [loading,  setLoading]  = useState(false)
  const flyTo         = useMapStore(s => s.flyTo)
  const openPlace     = useDrawerStore(s => s.openPlace)
  const setChatRequest = useRouteStore(s => s.setChatRequest)

  const load = useCallback(async () => {
    if (!isLogged) return
    setLoading(true)
    try {
      const [f, r] = await Promise.all([fetchFavorites(), fetchSavedRoutes()])
      setFavs(Array.isArray(f) ? f : (f?.data ?? []))
      setRoutes(Array.isArray(r) ? r : (r?.data ?? []))
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [isLogged])

  useEffect(() => { load() }, [load])

  const handleDeleteFav = async (id) => {
    await deleteFavorite(id)
    setFavs(prev => prev.filter(f => f.id !== id))
  }

  const handleDeleteRoute = async (id) => {
    await deleteSavedRoute(id)
    setRoutes(prev => prev.filter(r => r.id !== id))
  }

  const handleSelectFav = (fav) => {
    flyTo({ lat: fav.lat, lng: fav.lng, zoom: 16 })
    openPlace({ kind: 'fav', id: fav.id, name: fav.name, lat: fav.lat, lng: fav.lng, address: fav.address })
  }

  const handleLoadRoute = (route) => {
    setChatRequest({
      origin:      { lat: route.from_lat, lng: route.from_lng, label: route.from_label },
      destination: { lat: route.to_lat,   lng: route.to_lng,   label: route.to_label  },
      mode:        route.mode ?? 'foot',
    })
    flyTo({ lat: route.to_lat, lng: route.to_lng, zoom: 14 })
  }

  if (!isLogged) {
    return <EmptyState icon={Icons.user} text={t('drawer.savedView.loginHint')} />
  }

  return (
    <>
      {/* Tabs */}
      <div className="flex px-3 pt-2.5 pb-0 gap-1" style={{ borderBottom: '1px solid #2C2926' }}>
        {[
          { id: TAB.favs,     label: t('drawer.savedView.favs') },
          { id: TAB.routes,   label: t('drawer.savedView.routes') },
          { id: TAB.commutes, label: t('drawer.savedView.commutes') },
        ].map(tabItem => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className="px-3 pb-2.5 font-syne text-[12px] font-medium transition-colors relative"
            style={{ color: tab === tabItem.id ? '#F7F6F4' : '#8C8884' }}
          >
            {tabItem.label}
            {tab === tabItem.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ background: '#B8885A' }} />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && (
          <div className="px-6 py-12 flex justify-center gap-1.5">
            {[0, 140, 280].map(d => (
              <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#B8885A', animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}

        {!loading && tab === TAB.favs && (
          favs.length === 0
            ? <EmptyState icon={Icons.pin} text={t('drawer.savedView.empty')} />
            : <ul>{favs.map(f => <FavRow key={f.id} fav={f} onDelete={handleDeleteFav} onSelect={handleSelectFav} />)}</ul>
        )}

        {!loading && tab === TAB.routes && (
          routes.length === 0
            ? <EmptyState icon={Icons.search} text={t('drawer.savedView.emptyRoutes')} />
            : <ul>{routes.map(r => <RouteRow key={r.id} route={r} onDelete={handleDeleteRoute} onLoad={handleLoadRoute} />)}</ul>
        )}

        {tab === TAB.commutes && <CommuteView />}
      </div>
    </>
  )
}
