import Link from 'next/link'
import { getAdminData } from '@/lib/supabase/server'

export default async function AdminOverview() {
  const [levels, profiles, announcements, content, settings, auditLog, pendingRecords] =
    await getAdminData()

  const stats = [
    { label: 'Pending records', count: pendingRecords.length, href: '/admin/records' },
    { label: 'Published levels', count: levels.filter((l: Record<string, unknown>) => l.published).length, href: '/admin/levels' },
    { label: 'Unpublished levels', count: levels.filter((l: Record<string, unknown>) => !l.published).length, href: '/admin/levels' },
    { label: 'Profiles', count: profiles.length, href: '/admin/profiles' },
    { label: 'Announcements', count: announcements.length, href: '/admin/content' },
    { label: 'Audit entries', count: auditLog.length, href: '/admin/audit' },
  ]

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-white">Admin overview</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="border border-[#292929] bg-[#111] p-5 transition hover:border-[#444]"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#a5a5a5]">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stat.count}</p>
          </Link>
        ))}
      </div>

      {pendingRecords.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#a5a5a5]">Recent pending records</h2>
          <div className="border border-[#292929] bg-[#111]">
            <table className="w-full border-collapse text-left text-[12px]">
              <thead className="border-b border-[#292929] bg-[#151515] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Player</th>
                  <th className="px-4 py-2.5 font-medium">Level</th>
                  <th className="px-4 py-2.5 font-medium">Progress</th>
                  <th className="px-4 py-2.5 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {pendingRecords.slice(0, 5).map((r: Record<string, unknown>) => (
                  <tr key={r.id as string} className="border-b border-[#242424] last:border-0">
                    <td className="px-4 py-3 text-[#ddd]">{(r as { profiles?: { display_name?: string } })?.profiles?.display_name ?? 'Unknown'}</td>
                    <td className="px-4 py-3 text-[#8c8c8c]">{(r as { levels?: { name?: string } })?.levels?.name ?? 'Unknown'}</td>
                    <td className="px-4 py-3 text-[#b22222]">{r.progress as number}%</td>
                    <td className="px-4 py-3 text-[#5f5f5f]">{new Date(r.created_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
