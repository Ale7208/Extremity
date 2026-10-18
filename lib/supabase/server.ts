import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createJsClient } from '@supabase/supabase-js'

/**
 * Creates a cookieless Supabase client using the anon key.
 * Used for public data queries that don't need user session info.
 * RLS policies still enforce access control on public columns.
 */
export function createAnonClient() {
  return createJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * Creates a Supabase server client bound to the incoming request's user session.
 * Uses the anon key + cookies — RLS policies are enforced.
 */
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {}
        },
      },
    },
  )
}

/**
 * Creates a Supabase admin client using the service role key.
 * This client bypasses RLS and has full access to all columns.
 * MUST only be used in server-side code (API routes, Server Actions, Server Components).
 * NEVER expose the service role key to the browser.
 *
 * If the service role key is not configured, returns null. Callers must handle
 * this gracefully (return 500 or empty data).
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.EXTREMITY_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return null
  return createJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  )
}

/**
 * Checks if the current request's user is an admin by calling the database
 * function check_is_admin(), which reads raw_app_meta_data from auth.users
 * using a SECURITY DEFINER function. This is the authoritative source —
 * app_metadata in the JWT may be stale or missing the role field.
 * Returns false if no session or if the role is not 'admin'.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.rpc('check_is_admin', { p_user_id: user.id })
  return data === true
}

/**
 * Returns the current authenticated user, or null.
 */
export async function getAuthUser() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

// ──────────────────────────────────────────────
// Public data queries (anon-key compatible, only public columns)
// ──────────────────────────────────────────────

export type PublicPlayer = {
  id: string
  name: string
  points: number
  records: number
  best: string
  rank: number
}

export type PublicRankings = {
  players: PublicPlayer[]
  recent: {
    player: string
    level: string
    progress: string
    date: string
  }[]
}

export async function getPublicRankings(): Promise<PublicRankings | null> {
  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('records')
    .select(
      'player_id, progress, created_at, profiles(display_name), levels(name, points)',
    )
    .eq('status', 'approved')

  if (error || !data?.length) return null

  const totals = new Map<string, PublicPlayer>()
  for (const row of data as unknown as {
    player_id: string
    progress: number
    created_at: string
    profiles?: { display_name: string }
    levels?: { name: string; points: number }
  }[]) {
    const name = row.profiles?.display_name ?? 'Unknown'
    const level = row.levels?.name ?? 'Unknown level'
    const levelPoints = Number(row.levels?.points ?? 0)
    const points =
      row.progress === 100
        ? levelPoints
        : Math.round((levelPoints * row.progress) / 100)
    const current =
      totals.get(row.player_id) ??
      ({ id: row.player_id, name, points: 0, records: 0, best: level } as PublicPlayer)
    current.points += points
    current.records += row.progress === 100 ? 1 : 0
    totals.set(row.player_id, current)
  }

  const players = [...totals.values()]
    .sort((a, b) => b.points - a.points)
    .map((player, index) => ({ ...player, rank: index + 1 }))

  const recent = (data as unknown as {
    profiles?: { display_name: string }
    levels?: { name: string }
    progress: number
    created_at: string
  }[])
    .slice(0, 6)
    .map((row) => ({
      player: row.profiles?.display_name ?? 'Unknown',
      level: row.levels?.name ?? 'Unknown level',
      progress: `${row.progress}%`,
      date: new Date(row.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }))

  return { players, recent }
}

export async function getSiteContent(): Promise<Record<string, string>> {
  const supabase = createAnonClient()
  const { data } = await supabase
    .from('site_content')
    .select('key, value')
    .eq('published', true)
  return Object.fromEntries(
    (data ?? []).map((item) => [item.key, item.value]),
  )
}

export async function getPublicAnnouncements() {
  const supabase = createAnonClient()
  const { data } = await supabase
    .from('announcements')
    .select('id, title, body, published_at')
    .eq('published', true)
    .order('sort_order')
    .limit(5)
  return data ?? []
}

export async function getPublicLevels() {
  const supabase = createAnonClient()
  const { data } = await supabase
    .from('levels')
    .select('id, name, gd_level_id, difficulty, points')
    .eq('published', true)
    .order('points', { ascending: false })
  return data ?? []
}

export async function getPublicData() {
  return Promise.all([getPublicRankings(), getSiteContent(), getPublicAnnouncements()])
}

// ──────────────────────────────────────────────
// User-scoped queries (authenticated, RLS enforced)
// ──────────────────────────────────────────────

export async function getUserProfile(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, badges, suspended, created_at')
    .eq('id', userId)
    .maybeSingle()
  return data
}

export async function getUserGdIdentity(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('gd_identities')
    .select(
      'id, user_id, gd_player_id, gd_player_name, verification_token, verification_status, created_at, updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function getUserProposals(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('level_proposals')
    .select('id, proposed_by, name, gd_level_id, status, created_at')
    .eq('proposed_by', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getUserRecords(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('records')
    .select(
      'id, player_id, level_id, level_proposal_id, progress, evidence_url, status, created_at, levels(name, points)',
    )
    .eq('player_id', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

// ──────────────────────────────────────────────
// Admin queries (service role key — bypasses RLS)
// These functions return null/empty if the service role key is not configured.
// ──────────────────────────────────────────────

export async function getAdminLevels() {
  const admin = createAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('levels')
    .select('id, name, gd_level_id, difficulty, points, published, created_at')
    .order('points', { ascending: false })
  return data ?? []
}

export async function getAdminProfiles() {
  const admin = createAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('profiles')
    .select('id, display_name, badges, suspended, created_at')
    .order('display_name')
  return data ?? []
}

export async function getAdminAllAnnouncements() {
  const admin = createAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('announcements')
    .select('id, title, body, published, published_at, sort_order, created_at')
    .order('sort_order')
  return data ?? []
}

export async function getAdminContentRows() {
  const admin = createAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('site_content')
    .select('key, value, published, updated_at')
    .order('key')
  return data ?? []
}

export async function getAdminSettings() {
  const admin = createAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('site_settings')
    .select('key, value, updated_at')
    .order('key')
  return data ?? []
}

export async function getAdminAuditLog() {
  const admin = createAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('admin_audit_log')
    .select('id, actor_id, action, entity, entity_id, changes, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}

export async function getAdminPendingRecords() {
  const admin = createAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('records')
    .select(
      'id, player_id, level_id, level_proposal_id, progress, evidence_url, notes, status, reviewer_id, reviewed_at, created_at, profiles(display_name), levels(name, points)',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getAdminAllRecords() {
  const admin = createAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('records')
    .select(
      'id, player_id, level_id, level_proposal_id, progress, evidence_url, notes, status, reviewer_id, reviewed_at, created_at, profiles(display_name), levels(name, points)',
    )
    .order('created_at', { ascending: false })
    .limit(100)
  return data ?? []
}

export async function getAdminGdIdentities() {
  const admin = createAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('gd_identities')
    .select(
      'id, user_id, gd_player_id, gd_player_name, verification_token, verification_status, verified_at, verified_by, notes, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getAdminLevelProposals() {
  const admin = createAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('level_proposals')
    .select(
      'id, proposed_by, name, gd_level_id, status, reviewed_by, reviewed_at, notes, created_at',
    )
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getAdminData() {
  return Promise.all([
    getAdminLevels(),
    getAdminProfiles(),
    getAdminAllAnnouncements(),
    getAdminContentRows(),
    getAdminSettings(),
    getAdminAuditLog(),
    getAdminPendingRecords(),
  ])
}

/**
 * Writes an audit log entry using the admin client.
 * Called from API routes after verifying admin status.
 */
export async function writeAudit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string | null,
  changes: Record<string, unknown>,
) {
  const admin = createAdminClient()
  if (!admin) return
  await admin.from('admin_audit_log').insert({
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId,
    changes,
  })
}
