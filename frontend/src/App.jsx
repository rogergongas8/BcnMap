import React, { useState, useEffect } from 'react'
import MapContainer from './components/Map/MapContainer'
import MapControls from './components/Map/MapControls'
import CameraControls from './components/Map/CameraControls'
import MapClickHandler from './components/Map/MapClickHandler'

import TrafficLayer from './components/Map/layers/TrafficLayer'
import BicingLayer from './components/Map/layers/BicingLayer'
import BusLayer from './components/Map/layers/BusLayer'
import MetroLayer from './components/Map/layers/MetroLayer'
import AirQualityLayer from './components/Map/layers/AirQualityLayer'
import BeachLayer from './components/Map/layers/BeachLayer'
import NearbyPoiLayer from './components/Map/layers/NearbyPoiLayer'
import RouteLayer from './components/Map/layers/RouteLayer'
import UserLocationLayer from './components/Map/layers/UserLocationLayer'
import PinLayer from './components/Map/layers/PinLayer'

import TopBar from './components/UI/TopBar'
import SideDrawer from './components/UI/Drawer/SideDrawer'
import Tooltip from './components/UI/Tooltip'
import ErrorBoundary from './components/UI/ErrorBoundary'

import ChatPanel from './components/Chat/ChatPanel'
import SearchBar from './components/Route/SearchBar'
import NavigationHUD from './components/Route/NavigationHUD'

import { useMapData } from './hooks/useMapData'
import { useWebSocket } from './hooks/useWebSocket'
import { useDeepLink } from './hooks/useDeepLink'
import { useDrawerStore } from './store/drawerStore'
import { useChatStore } from './store/chatStore'
import { useMapStore } from './store/mapStore'

// Centralised map padding — single source of truth
function useMapPadding() {
  const view     = useDrawerStore(s => s.view)
  const chatOpen = useChatStore(s => s.isOpen)
  const setMapPadding = useMapStore(s => s.setMapPadding)

  useEffect(() => {
    setMapPadding({
      top:    56,
      left:   view ? 400 : 0,
      right:  chatOpen ? 340 : 0,
      bottom: 0,
    })
  }, [view, chatOpen, setMapPadding])
}

function AppContent() {
  const [hoverInfo, setHoverInfo] = useState(null)

  useMapData()
  useWebSocket()
  useDeepLink()
  useMapPadding()

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#0e0e0e' }}>
      {/* ── Map (fills everything, topbar sits above) ── */}
      <MapContainer />
      <MapClickHandler />

      {/* ── Map data layers ── */}
      <TrafficLayer />
      <BicingLayer onHover={setHoverInfo} />
      <BusLayer onHover={setHoverInfo} />
      <MetroLayer onHover={setHoverInfo} />
      <AirQualityLayer visible />
      <BeachLayer />
      <NearbyPoiLayer />
      <RouteLayer />
      <UserLocationLayer />
      <PinLayer />

      {/* ── Top bar — 56px, z-50, full width ── */}
      <TopBar>
        <SearchBar embedded />
      </TopBar>

      {/* ── Side panels (start below TopBar) ── */}
      <SideDrawer />
      <ChatPanel />

      {/* ── Map camera controls ── */}
      <CameraControls />
      <MapControls />

      {/* ── Bottom HUDs ── */}
      <NavigationHUD />

      {/* ── Hover tooltips ── */}
      {hoverInfo && <Tooltip info={hoverInfo} />}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}
