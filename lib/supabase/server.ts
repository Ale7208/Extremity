import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    },
  )
}

export type PublicPlayer = { id: string; name: string; points: number; records: number; best: string }
export type PublicRecord = { player: string; level: string; progress: string; date: string }

export async function getPublicRankings() {
  const supabase = await createClient()
  const { data } = await supabase.from('records').select('player_id, progress, created_at, profiles(display_name), levels(name, points)').eq('status', 'approved')
  if (!data?.length) return null

  const totals = new Map<string, PublicPlayer>()
  for (const row of data as any[]) {
    const name = row.profiles?.display_name ?? 'Unknown'
    const level = row.levels?.name ?? 'Unknown level'
    const points = row.progress === 100 ? Number(row.levels?.points ?? 0) : Math.round(Number(row.levels?.points ?? 0) * row.progress / 100)
    const current = totals.get(row.player_id) ?? { id: row.player_id, name, points: 0, records: 0, best: level }
    current.points += points
    current.records += row.progress === 100 ? 1 : 0
    totals.set(row.player_id, current)
  }
  return { players: [...totals.values()].sort((a, b) => b.points - a.points).map((player, index) => ({ ...player, rank: index + 1 })), recent: (data as any[]).slice(0, 4).map((row) => ({ player: row.profiles?.display_name ?? 'Unknown', level: row.levels?.name ?? 'Unknown level', progress: `${row.progress}%`, date: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })) }
}

export async function getSiteContent() {
  const supabase = await createClient()
  const { data } = await supabase.from('site_content').select('key, value').eq('published', true)
  return Object.fromEntries((data ?? []).map((item) => [item.key, item.value]))
}

export async function getPublicAnnouncements() {
  const supabase = await createClient()
  const { data } = await supabase.from('announcements').select('id, title, body, published_at').eq('published', true).order('sort_order').limit(5)
  return data ?? []
}

export async function isAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminId = process.env.SUPABASE_ADMIN_USER_ID
  return Boolean(user && adminId && user.id === adminId)
}

export async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getAdminUserId() {
  return process.env.SUPABASE_ADMIN_USER_ID
}

export async function getServerClient() { return createClient() }

export async function getPublicRecords() {
  const supabase = await createClient()
  const { data } = await supabase.from('records').select('id, progress, evidence_url, notes, status, created_at, profiles(display_name), levels(name, points)').order('created_at', { ascending: false }).limit(50)
  return data ?? []
}

export async function getLevels() {
  const supabase = await createClient()
  const { data } = await supabase.from('levels').select('id, name, difficulty, points, published').order('points', { ascending: false })
  return data ?? []
}

export async function getProfiles() {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('id, display_name, badges, suspended, created_at').order('display_name')
  return data ?? []
}

export async function getAllAnnouncements() {
  const supabase = await createClient()
  const { data } = await supabase.from('announcements').select('id, title, body, published, published_at, sort_order').order('sort_order')
  return data ?? []
}

export async function getContentRows() {
  const supabase = await createClient()
  const { data } = await supabase.from('site_content').select('key, value, published').order('key')
  return data ?? []
}

export async function getSettings() {
  const supabase = await createClient()
  const { data } = await supabase.from('site_settings').select('key, value').order('key')
  return data ?? []
}

export async function getAuditLog() {
  const supabase = await createClient()
  const { data } = await supabase.from('admin_audit_log').select('id, action, entity, entity_id, changes, created_at').order('created_at', { ascending: false }).limit(50)
  return data ?? []
}

export async function getPendingRecords() {
  const supabase = await createClient()
  const { data } = await supabase.from('records').select('id, progress, evidence_url, notes, status, created_at, profiles(display_name), levels(name, points)').eq('status', 'pending').order('created_at', { ascending: false })
  return data ?? []
}

export async function getAdminData() { return Promise.all([getLevels(), getProfiles(), getAllAnnouncements(), getContentRows(), getSettings(), getAuditLog(), getPendingRecords()]) }

export async function writeAudit(action: string, entity: string, entityId: string | null, changes: Record<string, unknown>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('admin_audit_log').insert({ actor_id: user.id, action, entity, entity_id: entityId, changes })
}

export async function getPublicData() { return Promise.all([getPublicRankings(), getSiteContent(), getPublicAnnouncements()]) }
