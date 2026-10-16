'use client'

import { useState } from 'react'

type Profile = {
  id: string
  display_name: string
  badges: string[]
  suspended: boolean
  created_at: string
}

export default function AdminProfilesClient({ profiles }: { profiles: Profile[] }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAction(profileId: string, action: 'suspend' | 'unsuspend') {
    setLoading(profileId + action)
    setError(null)
    const res = await fetch('/api/admin/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, action }),
    })
    const json = await res.json()
    if (!res.ok) setError(json.error ?? 'Failed')
    else setTimeout(() => window.location.reload(), 500)
    setLoading(null)
  }

  return (
    <div className="space-y-4">
      {error && <div className="border border-[#3a2020] bg-[#1a0e0e] px-4 py-2 text-xs text-[#c97878]">{error}</div>}

      <div className="overflow-x-auto border border-[#292929] bg-[#111]">
        <table className="w-full min-w-[600px] border-collapse text-left text-[12px]">
          <thead className="border-b border-[#292929] bg-[#151515] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Display name</th>
              <th className="px-4 py-2.5 font-medium">Badges</th>
              <th className="px-4 py-2.5 font-medium">Suspended</th>
              <th className="px-4 py-2.5 font-medium">Joined</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-[#666]">No profiles.</td></tr>
            ) : (
              profiles.map((p) => (
                <tr key={p.id} className="border-b border-[#242424] last:border-0">
                  <td className="px-4 py-3 text-[#ddd]">{p.display_name}</td>
                  <td className="px-4 py-3 text-[#8c8c8c]">{Array.isArray(p.badges) ? p.badges.join(', ') || '—' : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={p.suspended ? 'text-[#c97878]' : 'text-[#555]'}>{p.suspended ? 'Yes' : 'No'}</span>
                  </td>
                  <td className="px-4 py-3 text-[#5f5f5f]">{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleAction(p.id, p.suspended ? 'unsuspend' : 'suspend')}
                      disabled={loading === p.id + (p.suspended ? 'unsuspend' : 'suspend')}
                      className={`border px-2 py-1 text-[10px] disabled:opacity-50 ${p.suspended ? 'border-[#1e3a1e] bg-[#0e1a0e] text-green-500 hover:bg-[#142a14]' : 'border-[#3a2020] bg-[#1a0e0e] text-[#c97878] hover:bg-[#241414]'}`}
                    >
                      {loading === p.id + (p.suspended ? 'unsuspend' : 'suspend') ? '…' : p.suspended ? 'Unsuspend' : 'Suspend'}
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
