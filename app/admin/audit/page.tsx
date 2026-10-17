import { getAdminAuditLog } from '@/lib/supabase/server'

export default async function AdminAuditPage() {
  const auditLog = await getAdminAuditLog()

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-white">Registro de auditoría</h1>
      <div className="overflow-x-auto border border-[#292929] bg-[#111]">
        <table className="w-full min-w-[700px] border-collapse text-left text-[12px]">
          <thead className="border-b border-[#292929] bg-[#151515] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Acción</th>
              <th className="px-4 py-2.5 font-medium">Entidad</th>
              <th className="px-4 py-2.5 font-medium">ID de entidad</th>
              <th className="px-4 py-2.5 font-medium">Cambios</th>
              <th className="px-4 py-2.5 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {auditLog.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-[#666]">No hay entradas de auditoría.</td></tr>
            ) : (
              auditLog.map((entry: Record<string, unknown>) => (
                <tr key={entry.id as string} className="border-b border-[#242424] last:border-0">
                  <td className="px-4 py-3 text-[#ddd]">{entry.action as string}</td>
                  <td className="px-4 py-3 text-[#8c8c8c]">{entry.entity as string}</td>
                  <td className="px-4 py-3 text-[#5f5f5f] font-mono text-[10px]">{(entry.entity_id as string) ?? '—'}</td>
                  <td className="px-4 py-3 text-[#666] max-w-[200px] truncate">
                    {entry.changes ? JSON.stringify(entry.changes) : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#5f5f5f]">{new Date(entry.created_at as string).toLocaleString('es-MX')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
