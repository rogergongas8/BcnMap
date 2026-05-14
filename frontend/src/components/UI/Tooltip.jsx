import React from 'react'

function ArrivalBadge({ mins, dim }) {
  const color = mins <= 1 ? 'text-green-400' : mins <= 5 ? 'text-yellow-400' : dim ? 'text-white/30' : 'text-white/70'
  return <span className={`text-[10px] font-mono tabular-nums ${color}`}>{mins <= 0 ? 'ara' : `${mins}'`}</span>
}

function BusTooltip({ object }) {
  const buses = object.buses ?? []

  return (
    <>
      <div className="text-white font-mono text-xs mb-0.5 max-w-[220px] truncate">
        {object.stop_name}
      </div>
      {object.address && (
        <div className="text-white/35 text-[10px] mb-2 max-w-[220px] truncate">
          {object.address}
        </div>
      )}
      {object.loading ? (
        <div className="text-white/30 text-[10px]">Carregant...</div>
      ) : buses.length === 0 ? (
        <div className="text-white/30 text-[10px]">Sense dades en temps real</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {buses.slice(0, 6).map((b, i) => {
            const arrivals = b.arrivals ?? []
            return (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: '#FF6B35', color: '#fff', minWidth: 28, textAlign: 'center' }}
                >
                  {b.line}
                </span>
                <span className="text-white/55 text-[10px] truncate flex-1 max-w-[100px]">{b.dest}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {arrivals.map((mins, j) => (
                    <React.Fragment key={j}>
                      {j > 0 && <span className="text-white/20 text-[9px]">·</span>}
                      <ArrivalBadge mins={mins} dim={j > 0} />
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function MetroTooltip({ object }) {
  const lines  = object.lines  ?? []
  const trains = object.trains ?? []

  return (
    <>
      {/* Nombre + badges de líneas */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {lines.map((l, i) => (
          <span
            key={i}
            className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
            style={{ backgroundColor: '#' + l.color.replace(/^#/, ''), color: '#fff' }}
          >
            {l.name}
          </span>
        ))}
        <span className="text-white font-mono text-xs truncate max-w-[140px]">
          {object.station_name}
        </span>
      </div>

      {/* Próximos trenes */}
      {object.loading ? (
        <div className="text-white/30 text-[10px]">Carregant...</div>
      ) : trains.length === 0 ? (
        <div className="text-white/30 text-[10px]">Sense dades en temps real</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {trains.slice(0, 6).map((t, i) => {
            const arrivals = t.arrivals ?? []
            return (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    backgroundColor: '#' + t.color.replace(/^#/, ''),
                    color: '#fff',
                    minWidth: 28,
                    textAlign: 'center',
                  }}
                >
                  {t.line}
                </span>
                <span className="text-white/55 text-[10px] truncate flex-1 max-w-[100px]">{t.dest}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {arrivals.map((mins, j) => (
                    <React.Fragment key={j}>
                      {j > 0 && <span className="text-white/20 text-[9px]">·</span>}
                      <ArrivalBadge mins={mins} dim={j > 0} />
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function BicingTooltip({ object }) {
  return (
    <>
      <div className="text-white font-mono text-xs mb-1">{object.name}</div>
      <div className="flex gap-3">
        <span className="text-neon-blue">{object.bikes} bicis</span>
        {object.ebikes > 0 && (
          <span className="text-neon-green">{object.ebikes} elèct.</span>
        )}
        <span className="text-white/50">{object.docks} llocs</span>
      </div>
    </>
  )
}

function TrafficTooltip({ object }) {
  return (
    <>
      <div className="text-white font-mono text-xs mb-1">{object.name}</div>
      <div style={{
        color: object.estado === 'fluido'        ? '#27AE60' :
               object.estado === 'lento'         ? '#E67E22' :
               object.estado === 'congestionado' ? '#C0392B' : '#7B241C'
      }}>
        {object.estado?.toUpperCase() ?? ''}
      </div>
    </>
  )
}

export default function Tooltip({ info }) {
  if (!info?.object) return null

  const { x, y, object } = info

  return (
    <div
      className="panel-glass rounded-lg px-3 py-2 text-xs pointer-events-none absolute z-50"
      style={{ left: x + 12, top: y - 10, maxWidth: 220 }}
    >
      {(object.type === 'metro' || object.type === 'tram' || object.type === 'fgc')
                              ? <MetroTooltip object={object} />  :
       object.type === 'bus'   ? <BusTooltip object={object} />    :
       object.bikes != null    ? <BicingTooltip object={object} /> :
                                 <TrafficTooltip object={object} />}
    </div>
  )
}
