import React, { useState } from 'react'
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

import CityHud from './components/UI/CityHud'
import FloatingToolbar from './components/UI/FloatingToolbar'
import SideDrawer from './components/UI/Drawer/SideDrawer'
import Tooltip from './components/UI/Tooltip'
import ErrorBoundary from './components/UI/ErrorBoundary'

import ChatPanel from './components/Chat/ChatPanel'
import SearchBar from './components/Route/SearchBar'
import NavigationHUD from './components/Route/NavigationHUD'
import HistorySlider from './components/UI/HistorySlider'

import { useMapData } from './hooks/useMapData'
import { useWebSocket } from './hooks/useWebSocket'

function AppContent() {
  const [hoverInfo, setHoverInfo] = useState(null)

  useMapData()
  useWebSocket()

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <MapContainer />
      <MapClickHandler />

      {/* Map layers (renderless components) */}
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

      {/* Top-left: tools + drawer */}
      <FloatingToolbar />
      <SideDrawer />

      {/* Top-right: live data */}
      <CityHud />

      {/* Map camera + controls */}
      <CameraControls />
      <MapControls />

      {/* Chat + Search + Navigation */}
      <ChatPanel />
      <SearchBar />
      <NavigationHUD />

      {/* History time slider */}
      <HistorySlider />

      {/* Hover tooltips for layers */}
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
