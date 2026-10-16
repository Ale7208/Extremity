'use client'

import { useState } from 'react'

type Announcement = { id: string; title: string; body: string; published: boolean; published_at: string | null; sort_order: number }
type ContentRow = { key: string; value: string; published: boolean }
type SettingRow = { key: string; value: string }

export default function AdminContentClient({
  announcements,
  content,
  settings,
}: {
  announcements: Announcement[]
  content: ContentRow[]
  settings: SettingRow[]
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAnnForm, setShowAnnForm] = useState(false)
  const [annForm, setAnnForm] = useState({ title: '', body: '', published: false, sortOrder: '0' })

  async function toggleAnnouncement(id: string, currentPublished: boolean) {
    setLoading(id)
    setError(null)
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ announcementId: id, action: 'toggle', published: !currentPublished }),
    })
    const json = await res.json()
    if (!res.ok) setError(json.error ?? 'Failed')
    else setTimeout(() => window.location.reload(), 500)
    setLoading(null)
  }

  async function createAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    setLoading('create-ann')
    setError(null)
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        title: annForm.title,
        body: annForm.body,
        published: annForm.published,
        sortOrder: Number(annForm.sortOrder),
      }),
    })
    const json = await res.json()
    if (!res.ok) setError(json.error ?? 'Failed')
    else { setShowAnnForm(false); setTimeout(() => window.location.reload(), 500) }
    setLoading(null)
  }

  async function toggleContent(key: string, currentPublished: boolean) {
    setLoading(key)
    setError(null)
    const res = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, action: 'toggle', published: !currentPublished }),
    })
    const json = await res.json()
    if (!res.ok) setError(json.error ?? 'Failed')
    else setTimeout(() => window.location.reload(), 500)
    setLoading(null)
  }

  return (
    <div className="space-y-8">
      {error && <div className="border border-[#3a2020] bg-[#1a0e0e] px-4 py-2 text-xs text-[#c97878]">{error}</div>}

      {/* Announcements */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#a5a5a5]">Announcements</h2>
          <button onClick={() => setShowAnnForm(!showAnnForm)} className="border border-[#303030] px-2 py-1 text-[10px] text-[#aaa] hover:border-[#555]">
            {showAnnForm ? 'Cancel' : 'Add'}
          </button>
        </div>
        {showAnnForm && (
          <form onSubmit={createAnnouncement} className="mb-3 border border-[#292929] bg-[#111] p-4 space-y-3">
            <input placeholder="Title" required value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} className="w-full border border-[#303030] bg-[#0b0b0b] px-2 py-1.5 text-sm text-white outline-none focus:border-[#555]" />
            <textarea placeholder="Body" required value={annForm.body} onChange={(e) => setAnnForm({ ...annForm, body: e.target.value })} className="w-full border border-[#303030] bg-[#0b0b0b] px-2 py-1.5 text-sm text-white outline-none focus:border-[#555]" rows={3} />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-[#aaa]">
                <input type="checkbox" checked={annForm.published} onChange={(e) => setAnnForm({ ...annForm, published: e.target.checked })} /> Published
              </label>
              <input placeholder="Sort order" type="number" value={annForm.sortOrder} onChange={(e) => setAnnForm({ ...annForm, sortOrder: e.target.value })} className="w-24 border border-[#303030] bg-[#0b0b0b] px-2 py-1 text-sm text-white outline-none focus:border-[#555]" />
            </div>
            <button type="submit" disabled={loading === 'create-ann'} className="bg-[#b22222] px-3 py-1.5 text-xs text-white hover:bg-[#9a1d1d] disabled:opacity-50">
              {loading === 'create-ann' ? 'Creating…' : 'Create'}
            </button>
          </form>
        )}
        <div className="border border-[#292929] bg-[#111]">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="border-b border-[#292929] bg-[#151515] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Published</th>
                <th className="px-4 py-2.5 font-medium">Order</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {announcements.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-[#666]">No announcements.</td></tr>
              ) : (
                announcements.map((a) => (
                  <tr key={a.id} className="border-b border-[#242424] last:border-0">
                    <td className="px-4 py-3 text-[#ddd]">{a.title}</td>
                    <td className="px-4 py-3"><span className={a.published ? 'text-green-500' : 'text-[#555]'}>{a.published ? 'Yes' : 'No'}</span></td>
                    <td className="px-4 py-3 text-[#8c8c8c]">{a.sort_order}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleAnnouncement(a.id, a.published)} disabled={loading === a.id} className="border border-[#303030] px-2 py-1 text-[10px] text-[#aaa] hover:border-[#555] disabled:opacity-50">
                        {loading === a.id ? '…' : a.published ? 'Unpublish' : 'Publish'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Site content */}
      <section>
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#a5a5a5]">Site content</h2>
        <div className="border border-[#292929] bg-[#111]">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="border-b border-[#292929] bg-[#151515] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Key</th>
                <th className="px-4 py-2.5 font-medium">Value</th>
                <th className="px-4 py-2.5 font-medium">Published</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {content.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-[#666]">No content rows.</td></tr>
              ) : (
                content.map((c) => (
                  <tr key={c.key} className="border-b border-[#242424] last:border-0">
                    <td className="px-4 py-3 text-[#ddd]">{c.key}</td>
                    <td className="px-4 py-3 text-[#8c8c8c] max-w-[300px] truncate">{c.value}</td>
                    <td className="px-4 py-3"><span className={c.published ? 'text-green-500' : 'text-[#555]'}>{c.published ? 'Yes' : 'No'}</span></td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleContent(c.key, c.published)} disabled={loading === c.key} className="border border-[#303030] px-2 py-1 text-[10px] text-[#aaa] hover:border-[#555] disabled:opacity-50">
                        {loading === c.key ? '…' : c.published ? 'Unpublish' : 'Publish'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Settings */}
      <section>
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#a5a5a5]">Site settings (internal)</h2>
        <div className="border border-[#292929] bg-[#111]">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="border-b border-[#292929] bg-[#151515] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Key</th>
                <th className="px-4 py-2.5 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {settings.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-[#666]">No settings.</td></tr>
              ) : (
                settings.map((s) => (
                  <tr key={s.key} className="border-b border-[#242424] last:border-0">
                    <td className="px-4 py-3 text-[#ddd]">{s.key}</td>
                    <td className="px-4 py-3 text-[#8c8c8c]">{s.value}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
