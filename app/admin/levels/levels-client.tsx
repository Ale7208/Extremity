'use client'

import { useState } from 'react'

type Level = {
  id: string
  name: string
  gd_level_id: number
  difficulty: string
  points: number
  published: boolean
  created_at: string
}

export default function AdminLevelsClient({ levels }: { levels: Level[] }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', gdLevelId: '', difficulty: 'Unrated', points: '0', published: false })

  async function handleUpdate(id: string, field: string, value: string | boolean) {
    setLoading(id + field)
    setError(null)
    const res = await fetch('/api/admin/levels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ levelId: id, action: 'update', field, value }),
    })
    const json = await res.json()
    if (!res.ok) setError(json.error ?? 'Failed')
    else setTimeout(() => window.location.reload(), 500)
    setLoading(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading('create')
    setError(null)
    const res = await fetch('/api/admin/levels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        name: form.name,
        gdLevelId: Number(form.gdLevelId),
        difficulty: form.difficulty,
        points: Number(form.points),
        published: form.published,
      }),
    })
    const json = await res.json()
    if (!res.ok) setError(json.error ?? 'Failed')
    else { setShowForm(false); setTimeout(() => window.location.reload(), 500) }
    setLoading(null)
  }

  return (
    <div className="space-y-4">
      {error && <div className="border border-[#3a2020] bg-[#1a0e0e] px-4 py-2 text-xs text-[#c97878]">{error}</div>}

      <button
        onClick={() => setShowForm(!showForm)}
        className="border border-[#303030] bg-[#111] px-3 py-1.5 text-xs text-white hover:border-[#555]"
      >
        {showForm ? 'Cancel' : 'Add level'}
      </button>

      {showForm && (
        <form onSubmit={handleCreate} className="border border-[#292929] bg-[#111] p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input placeholder="Level name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-[#303030] bg-[#0b0b0b] px-2 py-1.5 text-sm text-white outline-none focus:border-[#555]" />
            <input placeholder="GD Level ID" type="number" required value={form.gdLevelId} onChange={(e) => setForm({ ...form, gdLevelId: e.target.value })} className="border border-[#303030] bg-[#0b0b0b] px-2 py-1.5 text-sm text-white outline-none focus:border-[#555]" />
            <input placeholder="Difficulty" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="border border-[#303030] bg-[#0b0b0b] px-2 py-1.5 text-sm text-white outline-none focus:border-[#555]" />
            <input placeholder="Points" type="number" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} className="border border-[#303030] bg-[#0b0b0b] px-2 py-1.5 text-sm text-white outline-none focus:border-[#555]" />
          </div>
          <label className="flex items-center gap-2 text-xs text-[#aaa]">
            <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Published
          </label>
          <button type="submit" disabled={loading === 'create'} className="bg-[#b22222] px-3 py-1.5 text-xs text-white hover:bg-[#9a1d1d] disabled:opacity-50">
            {loading === 'create' ? 'Creating…' : 'Create level'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto border border-[#292929] bg-[#111]">
        <table className="w-full min-w-[700px] border-collapse text-left text-[12px]">
          <thead className="border-b border-[#292929] bg-[#151515] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">GD ID</th>
              <th className="px-4 py-2.5 font-medium">Difficulty</th>
              <th className="px-4 py-2.5 font-medium">Points</th>
              <th className="px-4 py-2.5 font-medium">Published</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {levels.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[#666]">No levels.</td></tr>
            ) : (
              levels.map((level) => (
                <tr key={level.id} className="border-b border-[#242424] last:border-0">
                  <td className="px-4 py-3 text-[#ddd]">{level.name}</td>
                  <td className="px-4 py-3 text-[#8c8c8c]">{level.gd_level_id}</td>
                  <td className="px-4 py-3 text-[#8c8c8c]">{level.difficulty}</td>
                  <td className="px-4 py-3 text-[#ddd]">{level.points}</td>
                  <td className="px-4 py-3">
                    <span className={level.published ? 'text-green-500' : 'text-[#555]'}>{level.published ? 'Yes' : 'No'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleUpdate(level.id, 'published', !level.published)}
                      disabled={loading === level.id + 'published'}
                      className="border border-[#303030] px-2 py-1 text-[10px] text-[#aaa] hover:border-[#555] disabled:opacity-50"
                    >
                      {loading === level.id + 'published' ? '…' : level.published ? 'Unpublish' : 'Publish'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
