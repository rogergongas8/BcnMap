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
import PinLayer from './components/Map/layers/PinLayer'
import NearbyPoiLayer from './components/Map/layers/NearbyPoiLayer'
import StatsPanel from './components/UI/StatsPanel'
import WeatherWidget from './components/UI/WeatherWidget'
import LayerToggle from './components/UI/LayerToggle'
import Tooltip from './components/UI/Tooltip'
import ErrorBoundary from './components/UI/ErrorBoundary'
import PinInfoPanel from './components/UI/PinInfoPanel'
import BeachInfoPanel from './components/UI/BeachInfoPanel'
import NearbyPanel from './components/UI/NearbyPanel'
import ChatPanel from './components/Chat/ChatPanel'
import SearchBar from './components/Route/SearchBar'
import RouteLayer from './components/Map/layers/RouteLayer'
import UserLocationLayer from './components/Map/layers/UserLocationLayer'
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

      <StatsPanel />
      <WeatherWidget />
      <LayerToggle />
      <MapControls />
      <CameraControls />
      <ChatPanel />
      <SearchBar />
      <NearbyPanel />
      <PinInfoPanel />
      <BeachInfoPanel />

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
