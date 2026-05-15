import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info)
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-2xl">
        <div className="relative max-w-md w-full mx-6 p-8 rounded-2xl bg-black/90 border border-red-500/30 shadow-[0_0_60px_rgba(255,51,51,0.15)]">
          <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

          <div className="flex items-center gap-3 mb-4">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400/90 text-xs font-mono tracking-[0.2em] uppercase">System fault</span>
          </div>

          <h2 className="text-white text-lg font-medium mb-2">Algo ha fallado en BCN Live</h2>
          <p className="text-white/40 text-sm leading-relaxed mb-6">
            Hemos detectado un error en la interfaz. Puedes intentarlo de nuevo o recargar la página.
          </p>

          {import.meta.env.DEV && (
            <pre className="text-red-300/60 text-[10px] font-mono bg-red-950/20 border border-red-500/10 rounded-lg p-3 mb-6 overflow-auto max-h-32">
              {String(this.state.error?.stack ?? this.state.error)}
            </pre>
          )}

          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="flex-1 px-4 py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm font-mono hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all"
            >
              Reintentar
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/60 text-sm font-mono hover:bg-white/[0.08] hover:text-white/80 transition-all"
            >
              Recargar
            </button>
          </div>
        </div>
      </div>
    )
  }
}
