'use client'

import { useState, useEffect } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

export default function GdIdentityPage() {
  const supabase = createBrowserSupabaseClient()
  const [loading, setLoading] = useState(true)
  const [identity, setIdentity] = useState<{
    id: string
    gd_player_id: number
    gd_player_name: string
    verification_token: string
    verification_status: string
  } | null>(null)

  const [gdPlayerId, setGdPlayerId] = useState('')
  const [gdPlayerName, setGdPlayerName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('gd_identities')
        .select(
          'id, gd_player_id, gd_player_name, verification_token, verification_status',
        )
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        setIdentity(data as typeof identity)
        setGdPlayerId(String(data.gd_player_id))
        setGdPlayerName(data.gd_player_name)
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated')
      setSubmitting(false)
      return
    }

    const token = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 8)
      .toUpperCase()

    if (identity) {
      const { error: updateError } = await supabase
        .from('gd_identities')
        .update({
          gd_player_id: Number(gdPlayerId),
          gd_player_name: gdPlayerName,
          verification_token: token,
        })
        .eq('id', identity.id)

      if (updateError) {
        setError(updateError.message)
        setSubmitting(false)
        return
      }
      setSuccess('Identity updated. Place the verification token in your GD bio and wait for admin approval.')
    } else {
      const { error: insertError } = await supabase.from('gd_identities').insert({
        user_id: user.id,
        gd_player_id: Number(gdPlayerId),
        gd_player_name: gdPlayerName,
        verification_token: token,
      })

      if (insertError) {
        setError(insertError.message)
        setSubmitting(false)
        return
      }
      setSuccess('Identity submitted. Place the verification token in your GD bio and wait for admin approval.')
    }

    setIdentity({
      id: identity?.id ?? 'temp',
      gd_player_id: Number(gdPlayerId),
      gd_player_name: gdPlayerName,
      verification_token: token,
      verification_status: 'pending',
    })
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080808]">
        <p className="text-sm text-[#666]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f1f1f1]">
      <header className="border-b border-[#292929] bg-[#0b0b0b]">
        <nav className="mx-auto flex min-h-12 max-w-[1180px] items-center justify-between gap-6 px-4 sm:px-6">
          <a href="/" className="whitespace-nowrap text-[13px] font-semibold tracking-tight text-white">
            Extremity <span className="text-[#b22222]">List</span>
          </a>
          <a href="/dashboard" className="text-xs text-[#898989] hover:text-white">Back to dashboard</a>
        </nav>
      </header>

      <main className="mx-auto max-w-[600px] px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-xl font-semibold text-white">Geometry Dash identity</h1>

        {identity && identity.verification_status === 'verified' && (
          <div className="mb-6 border border-[#1e3a1e] bg-[#0e1a0e] px-4 py-3 text-xs text-green-500">
            Your GD identity is verified. You can submit records and propose levels.
          </div>
        )}
        {identity && identity.verification_status === 'pending' && (
          <div className="mb-6 border border-[#3a3a20] bg-[#1a1a0e] px-4 py-3 text-xs text-[#c9a878]">
            Your identity is pending verification. Place this token in your GD bio: <code className="font-mono text-[#e8c878]">{identity.verification_token}</code>
          </div>
        )}
        {identity && identity.verification_status === 'rejected' && (
          <div className="mb-6 border border-[#3a2020] bg-[#1a0e0e] px-4 py-3 text-xs text-[#c97878]">
            Your identity was rejected. Please update your information and try again.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-[#888]">GD Player ID (numeric)</label>
            <input
              type="number"
              required
              value={gdPlayerId}
              onChange={(e) => setGdPlayerId(e.target.value)}
              className="w-full border border-[#303030] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-[#555]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#888]">GD Player Name</label>
            <input
              type="text"
              required
              value={gdPlayerName}
              onChange={(e) => setGdPlayerName(e.target.value)}
              className="w-full border border-[#303030] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-[#555]"
            />
          </div>
          {error && <p className="text-xs text-[#c97878]">{error}</p>}
          {success && <p className="text-xs text-green-500">{success}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-[#b22222] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#9a1d1d] disabled:opacity-50"
          >
            {submitting ? 'Saving…' : identity ? 'Update identity' : 'Submit identity'}
          </button>
        </form>
      </main>
    </div>
  )
}