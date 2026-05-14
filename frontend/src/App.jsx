import React, { useState } from 'react'
import MapContainer from './components/Map/MapContainer'
import MapControls from './components/Map/MapControls'
import CameraControls from './components/Map/CameraControls'
import TrafficLayer from './components/Map/layers/TrafficLayer'
import BicingLayer from './components/Map/layers/BicingLayer'
import BusLayer from './components/Map/layers/BusLayer'
import MetroLayer from './components/Map/layers/MetroLayer'
import AirQualityLayer from './components/Map/layers/AirQualityLayer'
import StatsPanel from './components/UI/StatsPanel'
import WeatherWidget from './components/UI/WeatherWidget'
import LayerToggle from './components/UI/LayerToggle'
import Tooltip from './components/UI/Tooltip'
import ChatPanel from './components/Chat/ChatPanel'
import SearchBar from './components/Route/SearchBar'
import RouteLayer from './components/Map/layers/RouteLayer'
import UserLocationLayer from './components/Map/layers/UserLocationLayer'
import { useMapData } from './hooks/useMapData'
import { useWebSocket } from './hooks/useWebSocket'

export default function App() {
  const [hoverInfo, setHoverInfo] = useState(null)

  useMapData()
  useWebSocket()

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <MapContainer />

      <TrafficLayer />
      <BicingLayer onHover={setHoverInfo} />
      <BusLayer onHover={setHoverInfo} />
      <MetroLayer onHover={setHoverInfo} />
      <AirQualityLayer visible />
      <RouteLayer />
      <UserLocationLayer />

      <StatsPanel />
      <WeatherWidget />
      <LayerToggle />
      <MapControls />
      <CameraControls />
      <ChatPanel />
      <SearchBar />

      {hoverInfo && <Tooltip info={hoverInfo} />}
    </div>
  )
}
