import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  getAuthUser,
  getUserProfile,
  getUserGdIdentity,
  getUserRecords,
  getUserProposals,
  getPublicLevels,
} from '@/lib/supabase/server'
import type { Profile, GdIdentity } from '@/lib/types'

export default async function DashboardPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login?redirect=/dashboard')

  const [profile, gdIdentity, records, proposals, levels] = await Promise.all([
    getUserProfile(user.id),
    getUserGdIdentity(user.id),
    getUserRecords(user.id),
    getUserProposals(user.id),
    getPublicLevels(),
  ])

  const isVerified = gdIdentity?.verification_status === 'verified'
  const isPending = gdIdentity?.verification_status === 'pending'

  return (
    <div className="min-h-screen bg-[#080808] text-[#f1f1f1]">
      <header className="border-b border-[#292929] bg-[#0b0b0b]">
        <nav className="mx-auto flex min-h-12 max-w-[1180px] items-center justify-between gap-6 px-4 sm:px-6">
          <Link href="/" className="whitespace-nowrap text-[13px] font-semibold tracking-tight text-white">
            6B <span className="text-[#b22222]">Demon List</span>
          </Link>
          <div className="flex items-center gap-4 text-[11px] text-[#898989]">
            <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
            <Link href="/dashboard/identity" className="hover:text-white">GD Identity</Link>
            <Link href="/dashboard/submit" className="hover:text-white">Submit Record</Link>
            <Link href="/dashboard/propose" className="hover:text-white">Propose Level</Link>
            <a href="/logout" className="text-[#b22222] hover:underline">Sign out</a>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-xl font-semibold text-white">Your dashboard</h1>

        {/* Profile card */}
        <section className="mb-8 border border-[#292929] bg-[#111] p-5">
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[#a5a5a5]">Profile</h2>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm font-medium text-white">{(profile as Profile)?.display_name ?? 'Not set'}</p>
              <p className="text-xs text-[#777]">{user.email}</p>
              {(profile as Profile)?.suspended && (
                <p className="mt-1 text-xs text-[#c97878]">Your account is suspended. You cannot submit records.</p>
              )}
            </div>
          </div>
        </section>

        {/* GD Identity status */}
        <section className="mb-8 border border-[#292929] bg-[#111] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#a5a5a5]">Geometry Dash identity</h2>
            <Link href="/dashboard/identity" className="text-xs text-[#b22222] hover:underline">
              {gdIdentity ? 'Manage' : 'Set up'}
            </Link>
          </div>
          {!gdIdentity && (
            <p className="text-xs text-[#777]">No GD identity linked. You must verify your GD account before submitting records.</p>
          )}
          {gdIdentity && (
            <div className="space-y-1">
              <p className="text-sm text-white">
                {gdIdentity.gd_player_name} <span className="text-[#555]">(ID: {gdIdentity.gd_player_id})</span>
              </p>
              <p className={`text-xs ${isVerified ? 'text-green-500' : isPending ? 'text-[#c9a878]' : 'text-[#c97878]'}`}>
                Status: {gdIdentity.verification_status}
              </p>
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/dashboard/submit"
            className={`border border-[#292929] bg-[#111] p-5 transition hover:border-[#444] ${
              !isVerified ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            <h3 className="text-sm font-medium text-white">Submit a record</h3>
            <p className="mt-1 text-xs text-[#777]">
              {isVerified ? 'Submit your progress on a published level.' : 'Verify your GD identity first.'}
            </p>
          </Link>
          <Link
            href="/dashboard/propose"
            className={`border border-[#292929] bg-[#111] p-5 transition hover:border-[#444] ${
              !isVerified ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            <h3 className="text-sm font-medium text-white">Propose a level</h3>
            <p className="mt-1 text-xs text-[#777]">
              {isVerified ? 'Suggest a new level for the list.' : 'Verify your GD identity first.'}
            </p>
          </Link>
        </section>

        {/* My records */}
        <section className="mb-8">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#a5a5a5]">My records</h2>
          <div className="overflow-x-auto border border-[#292929] bg-[#111]">
            <table className="w-full min-w-[500px] border-collapse text-left text-[12px]">
              <thead className="border-b border-[#292929] bg-[#151515] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Level</th>
                  <th className="px-4 py-2.5 font-medium">Progress</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-[#666]">No records submitted yet.</td>
                  </tr>
                ) : (
                  records.map((r: Record<string, unknown>) => {
                    const levelName = (r as { levels?: { name?: string } })?.levels?.name ?? 'Unknown level'
                    return (
                      <tr key={r.id as string} className="border-b border-[#242424] last:border-0">
                        <td className="px-4 py-3 text-[#ddd]">{levelName}</td>
                        <td className="px-4 py-3 text-[#b22222]">{r.progress as number}%</td>
                        <td className="px-4 py-3 text-[#8c8c8c]">{r.status as string}</td>
                        <td className="px-4 py-3 text-[#5f5f5f]">
                          {new Date(r.created_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* My proposals */}
        <section>
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#a5a5a5]">My level proposals</h2>
          <div className="overflow-x-auto border border-[#292929] bg-[#111]">
            <table className="w-full min-w-[500px] border-collapse text-left text-[12px]">
              <thead className="border-b border-[#292929] bg-[#151515] text-[10px] uppercase tracking-[0.12em] text-[#686868]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">GD Level ID</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {proposals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-[#666]">No proposals submitted yet.</td>
                  </tr>
                ) : (
                  proposals.map((p: Record<string, unknown>) => (
                    <tr key={p.id as string} className="border-b border-[#242424] last:border-0">
                      <td className="px-4 py-3 text-[#ddd]">{p.name as string}</td>
                      <td className="px-4 py-3 text-[#8c8c8c]">{p.gd_level_id as number}</td>
                      <td className="px-4 py-3 text-[#8c8c8c]">{p.status as string}</td>
                      <td className="px-4 py-3 text-[#5f5f5f]">
                        {new Date(p.created_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
