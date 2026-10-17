'use client'

import { useState } from 'react'

type RecordRow = {
  id: string
  player_id: string
  level_id: string | null
  progress: number
  evidence_url: string | null
  notes: string | null
  status: string
  created_at: string
  profiles?: { display_name?: string }
  levels?: { name?: string; points?: number }
}

export default function AdminRecordsClient({
  pending,
  all,
}: {
  pending: RecordRow[]
  all: RecordRow[]
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleAction(recordId: string, action: 'approve' | 'reject') {
    setActionLoading(recordId + action)
    setError(null)
    setSuccess(null)
    const res = await fetch('/api/admin/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, action }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Error en la solicitud')
    } else {
      setSuccess(action === 'approve' ? 'Récord aprobado.' : 'Récord rechazado.')
      setTimeout(() => window.location.reload(), 800)
    }
    setActionLoading(null)
  }

  const isOwnRecord = (r: RecordRow) => false // Cannot know current user id on client safely; server enforces this

  return (
    <div className="space-y-8">
      {error && <div className="border border-[#3a2020] bg-[#1a0e0e] px-4 py-2 text-xs text-[#c97878]">{error}</div>}
      {success && <div className="border border-[#1e3a1e] bg-[#0e1a0e] px-4 py-2 text-xs text-green-500">{success}</div>}

      <section>
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#a5a5a5]">
          En espera de revisión ({pending.length})
        </h2>
        <div className="overflow-x-auto border border-[#292929] bg-[#111]">
          <table className="w-full min-w-[700px] border-collapse text-left text-[12px]">
            <thead className="border-b border-[#292929] bg-[#151515] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Jugador</th>
                <th className="px-4 py-2.5 font-medium">Nivel</th>
                <th className="px-4 py-2.5 font-medium">Progreso</th>
                <th className="px-4 py-2.5 font-medium">Evidencia</th>
                <th className="px-4 py-2.5 font-medium">Notas</th>
                <th className="px-4 py-2.5 font-medium">Enviado</th>
                <th className="px-4 py-2.5 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-[#666]">No hay récords pendientes.</td></tr>
              ) : (
                pending.map((r) => (
                  <tr key={r.id} className="border-b border-[#242424] last:border-0">
                    <td className="px-4 py-3 text-[#ddd]">{r.profiles?.display_name ?? 'Desconocido'}</td>
                    <td className="px-4 py-3 text-[#8c8c8c]">{r.levels?.name ?? 'Desconocido'}</td>
                    <td className="px-4 py-3 text-[#b22222]">{r.progress}%</td>
                    <td className="px-4 py-3 text-[#5577aa]">
                      {r.evidence_url ? <a href={r.evidence_url} target="_blank" rel="noopener noreferrer" className="hover:underline">Ver</a> : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#666]">{r.notes ?? '—'}</td>
                    <td className="px-4 py-3 text-[#5f5f5f]">{new Date(r.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(r.id, 'approve')}
                          disabled={actionLoading === r.id + 'approve'}
                          className="border border-[#1e3a1e] bg-[#0e1a0e] px-2 py-1 text-[10px] text-green-500 hover:bg-[#142a14] disabled:opacity-50"
                        >
                          {actionLoading === r.id + 'approve' ? '…' : 'Aprobar'}
                        </button>
                        <button
                          onClick={() => handleAction(r.id, 'reject')}
                          disabled={actionLoading === r.id + 'reject'}
                          className="border border-[#3a2020] bg-[#1a0e0e] px-2 py-1 text-[10px] text-[#c97878] hover:bg-[#241414] disabled:opacity-50"
                        >
                          {actionLoading === r.id + 'reject' ? '…' : 'Rechazar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] text-[#555]">El servidor bloquea aprobar tus propios récords. Si aparece un botón en tu propio récord, la API lo rechazará.</p>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#a5a5a5]">
          Todos los récords ({all.length})
        </h2>
        <div className="overflow-x-auto border border-[#292929] bg-[#111]">
          <table className="w-full min-w-[700px] border-collapse text-left text-[12px]">
            <thead className="border-b border-[#292929] bg-[#151515] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Jugador</th>
                <th className="px-4 py-2.5 font-medium">Nivel</th>
                <th className="px-4 py-2.5 font-medium">Progreso</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Enviado</th>
              </tr>
            </thead>
            <tbody>
              {all.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-[#666]">No hay récords.</td></tr>
              ) : (
                all.map((r) => (
                  <tr key={r.id} className="border-b border-[#242424] last:border-0">
                    <td className="px-4 py-3 text-[#ddd]">{r.profiles?.display_name ?? 'Desconocido'}</td>
                    <td className="px-4 py-3 text-[#8c8c8c]">{r.levels?.name ?? 'Desconocido'}</td>
                    <td className="px-4 py-3 text-[#b22222]">{r.progress}%</td>
                    <td className={`px-4 py-3 ${r.status === 'approved' ? 'text-green-500' : r.status === 'rejected' ? 'text-[#c97878]' : 'text-[#c9a878]'}`}>{r.status}</td>
                    <td className="px-4 py-3 text-[#5f5f5f]">{new Date(r.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}</td>
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
