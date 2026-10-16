'use client'

import { useState } from 'react'

type Proposal = {
  id: string
  proposed_by: string
  name: string
  gd_level_id: number
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  notes: string | null
  created_at: string
}

export default function AdminProposalsClient({ proposals }: { proposals: Proposal[] }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleAction(proposalId: string, action: 'approve' | 'reject') {
    setLoading(proposalId + action)
    setError(null)
    setSuccess(null)
    const res = await fetch('/api/admin/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId, action }),
    })
    const json = await res.json()
    if (!res.ok) setError(json.error ?? 'Failed')
    else {
      setSuccess(action === 'approve' ? 'Proposal approved — level created.' : 'Proposal rejected.')
      setTimeout(() => window.location.reload(), 800)
    }
    setLoading(null)
  }

  return (
    <div className="space-y-4">
      {error && <div className="border border-[#3a2020] bg-[#1a0e0e] px-4 py-2 text-xs text-[#c97878]">{error}</div>}
      {success && <div className="border border-[#1e3a1e] bg-[#0e1a0e] px-4 py-2 text-xs text-green-500">{success}</div>}

      <div className="overflow-x-auto border border-[#292929] bg-[#111]">
        <table className="w-full min-w-[700px] border-collapse text-left text-[12px]">
          <thead className="border-b border-[#292929] bg-[#151515] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">GD Level ID</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Notes</th>
              <th className="px-4 py-2.5 font-medium">Submitted</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {proposals.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[#666]">No proposals.</td></tr>
            ) : (
              proposals.map((p) => (
                <tr key={p.id} className="border-b border-[#242424] last:border-0">
                  <td className="px-4 py-3 text-[#ddd]">{p.name}</td>
                  <td className="px-4 py-3 text-[#8c8c8c]">{p.gd_level_id}</td>
                  <td className={`px-4 py-3 ${p.status === 'approved' ? 'text-green-500' : p.status === 'rejected' ? 'text-[#c97878]' : 'text-[#c9a878]'}`}>{p.status}</td>
                  <td className="px-4 py-3 text-[#666]">{p.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-[#5f5f5f]">{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  <td className="px-4 py-3">
                    {p.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(p.id, 'approve')}
                          disabled={loading === p.id + 'approve'}
                          className="border border-[#1e3a1e] bg-[#0e1a0e] px-2 py-1 text-[10px] text-green-500 hover:bg-[#142a14] disabled:opacity-50"
                        >
                          {loading === p.id + 'approve' ? '…' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleAction(p.id, 'reject')}
                          disabled={loading === p.id + 'reject'}
                          className="border border-[#3a2020] bg-[#1a0e0e] px-2 py-1 text-[10px] text-[#c97878] hover:bg-[#241414] disabled:opacity-50"
                        >
                          {loading === p.id + 'reject' ? '…' : 'Reject'}
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
