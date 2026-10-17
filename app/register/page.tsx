'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createBrowserSupabaseClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        display_name: displayName,
      })

      if (profileError) {
        setError(
          'Cuenta creada pero falló la configuración del perfil: ' + profileError.message,
        )
        setLoading(false)
        return
      }
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080808] px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-semibold text-white">
          Únete a <span className="text-[#b22222]">Extremity List</span>
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-[#888]">Nombre para mostrar</label>
            <input
              type="text"
              required
              maxLength={30}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-[#303030] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-[#555]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#888]">Correo electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#303030] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-[#555]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#888]">Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[#303030] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-[#555]"
            />
          </div>
          {error && <p className="text-xs text-[#c97878]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#b22222] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#9a1d1d] disabled:opacity-50"
          >
            {loading ? 'Creando cuenta…' : 'Registrarse'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-[#666]">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-[#b22222] hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
