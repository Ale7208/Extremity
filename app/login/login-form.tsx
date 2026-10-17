'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

export default function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createBrowserSupabaseClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080808] px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-semibold text-white">
          Sign in to <span className="text-[#b22222]">Extremity List</span>
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-[#888]">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#303030] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-[#555]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#888]">Password</label>
            <input
              type="password"
              required
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-[#666]">
          No account?{' '}
          <Link href="/register" className="text-[#b22222] hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
