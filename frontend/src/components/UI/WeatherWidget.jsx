import React from 'react'
import { motion } from 'framer-motion'
import { useDataStore } from '../../store/dataStore'

export default function WeatherWidget() {
  const weather    = useDataStore(s => s.weather)
  const airQuality = useDataStore(s => s.airQuality)

  if (!weather) return null

  const aqiColor = !airQuality ? '#666' :
    airQuality.aqi <= 50  ? '#00ff88' :
    airQuality.aqi <= 100 ? '#ffcc00' : '#ff3333'

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 4, duration: 0.4 }}
      className="absolute top-4 right-4 panel-glass rounded-xl px-4 py-3 min-w-40"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl font-mono font-bold text-white">
          {weather.temp}°
        </span>
        <div>
          <div className="text-white/60 text-xs capitalize">{weather.description}</div>
          <div className="text-white/40 text-xs">{weather.wind_speed} m/s vent</div>
        </div>
      </div>

      {airQuality && (
        <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: aqiColor }} />
          <span className="text-xs font-mono" style={{ color: aqiColor }}>
            AQI {airQuality.aqi}
          </span>
          <span className="text-white/40 text-xs">{airQuality.level}</span>
        </div>
      )}
    </motion.div>
  )
}
