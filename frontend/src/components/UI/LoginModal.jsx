import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'

export default function LoginModal({ onClose }) {
  const [tab, setTab]       = useState('login')
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        await login(email, pass)
      } else {
        await register(name, email, pass)
      }
      onClose()
    } catch (err) {
      const msg = err?.response?.data?.message
        ?? Object.values(err?.response?.data?.errors ?? {})[0]?.[0]
        ?? 'Error al autenticar'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-[#0d0f14] border border-white/[0.09]
            shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-white/80 text-sm font-mono">BCN Live</span>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors text-xl leading-none">×</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06]">
            {['login', 'register'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError('') }}
                className={`flex-1 py-2.5 text-[11px] font-mono tracking-wider transition-colors
                  ${tab === t ? 'text-cyan-400 border-b border-cyan-400' : 'text-white/30 hover:text-white/60'}`}
              >
                {t === 'login' ? 'Entrar' : 'Registrarse'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={submit} className="px-5 py-5 flex flex-col gap-3">
            {tab === 'register' && (
              <input
                type="text"
                placeholder="Nombre"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08]
                  text-white/85 text-sm font-mono placeholder-white/25 outline-none
                  focus:border-cyan-500/50 transition-colors"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08]
                text-white/85 text-sm font-mono placeholder-white/25 outline-none
                focus:border-cyan-500/50 transition-colors"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={pass}
              onChange={e => setPass(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08]
                text-white/85 text-sm font-mono placeholder-white/25 outline-none
                focus:border-cyan-500/50 transition-colors"
            />

            {error && (
              <p className="text-red-400/80 text-[11px] font-mono">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30
                text-cyan-300 text-sm font-mono tracking-wide
                hover:bg-cyan-500/25 hover:border-cyan-400/50 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed mt-1"
            >
              {loading ? '…' : tab === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
