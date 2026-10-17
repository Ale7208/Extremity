'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

type PublicLevel = {
  id: string
  name: string
  gd_level_id: number
  difficulty: string
  points: number
}

export default function SubmitRecordPage() {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()
  const [levels, setLevels] = useState<PublicLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLevel, setSelectedLevel] = useState('')
  const [progress, setProgress] = useState('100')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('levels')
        .select('id, name, gd_level_id, difficulty, points')
        .eq('published', true)
        .order('points', { ascending: false })
      setLevels((data ?? []) as PublicLevel[])
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
      setError('No autenticado')
      setSubmitting(false)
      return
    }

    const { error: insertError } = await supabase.from('records').insert({
      player_id: user.id,
      level_id: selectedLevel,
      progress: Number(progress),
      evidence_url: evidenceUrl || null,
    })

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    setSuccess('Récord enviado. Un administrador lo revisará antes de que aparezca en el ranking.')
    setSubmitting(false)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080808]">
        <p className="text-sm text-[#666]">Cargando…</p>
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
          <a href="/dashboard" className="text-xs text-[#898989] hover:text-white">Volver al panel</a>
        </nav>
      </header>

      <main className="mx-auto max-w-[600px] px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-xl font-semibold text-white">Enviar un récord</h1>

        {levels.length === 0 ? (
          <p className="text-sm text-[#777]">Aún no hay niveles publicados. Vuelve más tarde.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-[#888]">Nivel</label>
              <select
                required
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full border border-[#303030] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-[#555]"
              >
                <option value="">Selecciona un nivel…</option>
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name} ({level.difficulty}, {level.points} pts)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#888]">Progreso (%)</label>
              <input
                type="number"
                required
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                className="w-full border border-[#303030] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-[#555]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#888]">URL de evidencia (video o imagen)</label>
              <input
                type="url"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://youtube.com/…"
                className="w-full border border-[#303030] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-[#555]"
              />
            </div>
            {error && <p className="text-xs text-[#c97878]">{error}</p>}
            {success && <p className="text-xs text-green-500">{success}</p>}
            <button
              type="submit"
              disabled={submitting || !selectedLevel}
              className="bg-[#b22222] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#9a1d1d] disabled:opacity-50"
            >
              {submitting ? 'Enviando…' : 'Enviar récord'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
