import React, { useState, useRef } from 'react'
import { Icons } from '../icons'
import { geocodeSearch } from '../../../utils/geocode'

const MODES = [
  { id: 'foot',   label: 'A peu',  Icon: Icons.walking, color: '#a78bfa' },
  { id: 'bicing', label: 'Bicing', Icon: Icons.bike,    color: '#00ff88' },
  { id: 'bus',    label: 'Bus',    Icon: Icons.bus,     color: '#00b4ff' },
  { id: 'metro',  label: 'Metro',  Icon: Icons.metro,   color: '#ff6b35' },
  { id: 'car',    label: 'Cotxe',  Icon: Icons.car,     color: '#ffaa00' },
]

const DAYS = [
  { n: 1, label: 'Dl' }, { n: 2, label: 'Dt' }, { n: 3, label: 'Dc' },
  { n: 4, label: 'Dj' }, { n: 5, label: 'Dv' }, { n: 6, label: 'Ds' },
  { n: 7, label: 'Dg' },
]

function LocationInput({ label, value, onChange }) {
  const [query, setQuery]       = useState(value?.label ?? '')
  const [suggestions, setSugg]  = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  const handleInput = (e) => {
    const q = e.target.value
    setQuery(q)
    clearTimeout(debounceRef.current)
    if (q.length < 3) { setSugg([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await geocodeSearch(q)
        setSugg(results.slice(0, 4))
      } catch { setSugg([]) }
      setSearching(false)
    }, 350)
  }

  const select = (r) => {
    setQuery(r.label)
    setSugg([])
    onChange({ label: r.label, lat: r.lat, lng: r.lng })
  }

  return (
    <div className="relative">
      <label className="block font-mono text-[10px] mb-1" style={{ color: '#8C8884' }}>{label}</label>
      <div className="relative">
        <input
          value={query}
          onChange={handleInput}
          placeholder="Cerca una adreça..."
          className="w-full px-3 py-2 font-mono text-[11px] rounded outline-none"
          style={{ background: '#1C1A17', border: '1px solid #2C2926', color: '#F7F6F4' }}
          onFocus={e => { e.currentTarget.style.borderColor = '#B8885A' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#2C2926' }}
        />
        {searching && (
          <span className="absolute right-2.5 top-2.5 w-3 h-3 rounded-full border border-[#B8885A] border-t-transparent animate-spin" />
        )}
      </div>
      {suggestions.length > 0 && (
        <ul
          className="absolute z-50 left-0 right-0 mt-1 rounded overflow-hidden"
          style={{ background: '#1C1A17', border: '1px solid #2C2926' }}
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => select(s)}
              className="px-3 py-2 font-mono text-[11px] cursor-pointer transition-colors"
              style={{ color: '#F7F6F4', borderBottom: i < suggestions.length - 1 ? '1px solid #2C2926' : 'none' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#252320' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function CommuteForm({ initial, onSubmit, onCancel }) {
  const [name,        setName]        = useState(initial?.name ?? '')
  const [mode,        setMode]        = useState(initial?.mode ?? 'bus')
  const [origin,      setOrigin]      = useState(
    initial ? { label: initial.origin_label, lat: initial.origin_lat, lng: initial.origin_lng } : null
  )
  const [dest,        setDest]        = useState(
    initial ? { label: initial.dest_label, lat: initial.dest_lat, lng: initial.dest_lng } : null
  )
  const [days,        setDays]        = useState(initial?.days_of_week ?? [1, 2, 3, 4, 5])
  const [arrivalTime, setArrivalTime] = useState(initial?.arrival_time?.slice(0, 5) ?? '09:00')
  const [alertMins,   setAlertMins]   = useState(initial?.alert_minutes_before ?? 20)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)

  const toggleDay = (n) => {
    setDays(prev => prev.includes(n) ? prev.filter(d => d !== n) : [...prev, n])
  }

  const handleSubmit = async () => {
    if (!name.trim())  return setError('Posa un nom al trajecte')
    if (!origin)       return setError('Selecciona l\'origen')
    if (!dest)         return setError('Selecciona la destinació')
    if (!days.length)  return setError('Selecciona almenys un dia')

    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        name:                 name.trim(),
        mode,
        origin_label:         origin.label,
        origin_lat:           origin.lat,
        origin_lng:           origin.lng,
        dest_label:           dest.label,
        dest_lat:             dest.lat,
        dest_lng:             dest.lng,
        days_of_week:         days,
        arrival_time:         arrivalTime,
        alert_minutes_before: alertMins,
      })
    } catch (e) {
      setError(e.response?.data?.message ?? 'Error desant el trajecte')
      setSaving(false)
    }
  }

  const selectedMode = MODES.find(m => m.id === mode)

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="flex flex-col gap-4 px-4 py-4">

        {/* Name */}
        <div>
          <label className="block font-mono text-[10px] mb-1" style={{ color: '#8C8884' }}>Nom del trajecte</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Casa → Feina"
            className="w-full px-3 py-2 font-mono text-[11px] rounded outline-none"
            style={{ background: '#1C1A17', border: '1px solid #2C2926', color: '#F7F6F4' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#B8885A' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#2C2926' }}
          />
        </div>

        {/* Origin / Destination */}
        <LocationInput label="Origen (casa)" value={origin} onChange={setOrigin} />
        <LocationInput label="Destinació (feina)" value={dest} onChange={setDest} />

        {/* Mode */}
        <div>
          <label className="block font-mono text-[10px] mb-1.5" style={{ color: '#8C8884' }}>Mode de transport</label>
          <div className="flex gap-1.5">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded transition-colors"
                style={{
                  background: mode === m.id ? m.color + '18' : '#1C1A17',
                  border: `1px solid ${mode === m.id ? m.color + '55' : '#2C2926'}`,
                  color: mode === m.id ? m.color : '#8C8884',
                }}
              >
                <m.Icon size={12} />
                <span className="font-mono text-[8px]">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Days */}
        <div>
          <label className="block font-mono text-[10px] mb-1.5" style={{ color: '#8C8884' }}>Dies de la setmana</label>
          <div className="flex gap-1">
            {DAYS.map(d => (
              <button
                key={d.n}
                onClick={() => toggleDay(d.n)}
                className="flex-1 py-1.5 rounded font-mono text-[9px] font-medium transition-colors"
                style={{
                  background: days.includes(d.n) ? selectedMode.color + '18' : '#1C1A17',
                  border: `1px solid ${days.includes(d.n) ? selectedMode.color + '55' : '#2C2926'}`,
                  color: days.includes(d.n) ? selectedMode.color : '#8C8884',
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Arrival time */}
        <div>
          <label className="block font-mono text-[10px] mb-1" style={{ color: '#8C8884' }}>Hora d'arribada</label>
          <input
            type="time"
            value={arrivalTime}
            onChange={e => setArrivalTime(e.target.value)}
            className="w-full px-3 py-2 font-mono text-[11px] rounded outline-none"
            style={{ background: '#1C1A17', border: '1px solid #2C2926', color: '#F7F6F4' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#B8885A' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#2C2926' }}
          />
        </div>

        {/* Alert */}
        <div>
          <label className="block font-mono text-[10px] mb-1" style={{ color: '#8C8884' }}>
            Avisar {alertMins} min abans
          </label>
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={alertMins}
            onChange={e => setAlertMins(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: selectedMode.color }}
          />
          <div className="flex justify-between font-mono text-[9px] mt-0.5" style={{ color: '#5C5A56' }}>
            <span>5 min</span><span>60 min</span>
          </div>
        </div>

        {error && (
          <p className="font-mono text-[10px] px-3 py-2 rounded" style={{ background: '#D4555522', color: '#D45555', border: '1px solid #D4555544' }}>
            {error}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-2 px-4 pb-4 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded font-syne text-[12px] transition-colors"
          style={{ background: '#1C1A17', color: '#8C8884', border: '1px solid #2C2926' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#252320' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1C1A17' }}
        >
          Cancel·lar
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 py-2 rounded font-syne text-[12px] font-medium transition-colors"
          style={{ background: saving ? '#B8885A44' : '#B8885A22', color: '#B8885A', border: '1px solid #B8885A44' }}
          onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#B8885A33' }}
          onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#B8885A22' }}
        >
          {saving ? 'Desant...' : initial ? 'Desar canvis' : 'Crear trajecte'}
        </button>
      </div>
    </div>
  )
}
