'use client'

import { useState } from 'react'

type Identity = {
  id: string
  user_id: string
  gd_player_id: number
  gd_player_name: string
  verification_token: string
  verification_status: string
  verified_at: string | null
  verified_by: string | null
  notes: string | null
  created_at: string
}

export default function AdminIdentitiesClient({ identities }: { identities: Identity[] }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAction(identityId: string, action: 'verify' | 'reject') {
    setLoading(identityId + action)
    setError(null)
    const res = await fetch('/api/admin/identities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityId, action }),
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
        <table className="w-full min-w-[800px] border-collapse text-left text-[12px]">
          <thead className="border-b border-[#292929] bg-[#151515] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
            <tr>
              <th className="px-4 py-2.5 font-medium">GD Name</th>
              <th className="px-4 py-2.5 font-medium">GD ID</th>
              <th className="px-4 py-2.5 font-medium">Token</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Notes</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {identities.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[#666]">No identities.</td></tr>
            ) : (
              identities.map((id) => (
                <tr key={id.id} className="border-b border-[#242424] last:border-0">
                  <td className="px-4 py-3 text-[#ddd]">{id.gd_player_name}</td>
                  <td className="px-4 py-3 text-[#8c8c8c]">{id.gd_player_id}</td>
                  <td className="px-4 py-3 font-mono text-[#c9a878]">{id.verification_token}</td>
                  <td className={`px-4 py-3 ${id.verification_status === 'verified' ? 'text-green-500' : id.verification_status === 'rejected' ? 'text-[#c97878]' : 'text-[#c9a878]'}`}>{id.verification_status}</td>
                  <td className="px-4 py-3 text-[#666]">{id.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    {id.verification_status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(id.id, 'verify')}
                          disabled={loading === id.id + 'verify'}
                          className="border border-[#1e3a1e] bg-[#0e1a0e] px-2 py-1 text-[10px] text-green-500 hover:bg-[#142a14] disabled:opacity-50"
                        >
                          {loading === id.id + 'verify' ? '…' : 'Verify'}
                        </button>
                        <button
                          onClick={() => handleAction(id.id, 'reject')}
                          disabled={loading === id.id + 'reject'}
                          className="border border-[#3a2020] bg-[#1a0e0e] px-2 py-1 text-[10px] text-[#c97878] hover:bg-[#241414] disabled:opacity-50"
                        >
                          {loading === id.id + 'reject' ? '…' : 'Reject'}
                        </button>
                      </div>
                    )}
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
