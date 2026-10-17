'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

export default function ProposeLevelPage() {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()
  const [name, setName] = useState('')
  const [gdLevelId, setGdLevelId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('No autenticado')
      setSubmitting(false)
      return
    }

    const { error: insertError } = await supabase.from('level_proposals').insert({
      proposed_by: user.id,
      name,
      gd_level_id: Number(gdLevelId),
    })

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    setSuccess('Nivel propuesto. Un administrador lo revisará.')
    setSubmitting(false)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f1f1f1]">
      <header className="border-b border-[#292929] bg-[#0b0b0b]">
        <nav className="mx-auto flex min-h-12 max-w-[1180px] items-center justify-between gap-6 px-4 sm:px-6">
          <a href="/" className="whitespace-nowrap text-[13px] font-semibold tracking-tight text-white">
            Extremity <span className="text-[#b22222]">List</span>
          </a>
          <a href="/dashboard" className="text-xs text-[#898989] hover:text-white">Volver al panel</a>
        </nav>
      </header>

      <main className="mx-auto max-w-[600px] px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-xl font-semibold text-white">Proponer un nivel</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-[#888]">Nombre del nivel</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#303030] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-[#555]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#888]">ID de nivel GD (numérico)</label>
            <input
              type="number"
              required
              value={gdLevelId}
              onChange={(e) => setGdLevelId(e.target.value)}
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
            {submitting ? 'Enviando…' : 'Proponer nivel'}
          </button>
        </form>
      </main>
    </div>
  )
}
