import { NextResponse } from 'next/server'
import { createAdminClient, isAdmin, getAuthUser, writeAudit } from '@/lib/supabase/server'

/**
 * POST /api/admin/profiles
 * Body: { profileId: string, action: 'suspend' | 'unsuspend' }
 */
export async function POST(request: Request) {
  const [isAdminResult, authUser] = await Promise.all([isAdmin(), getAuthUser()])
  if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isAdminResult) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const body = await request.json()
  const { profileId, action } = body as { profileId?: string; action?: string }
  if (!profileId || !action || !['suspend', 'unsuspend'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const suspended = action === 'suspend'
  const { error } = await adminClient
    .from('profiles')
    .update({ suspended })
    .eq('id', profileId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAudit(authUser.id, `${action}_profile`, 'profiles', profileId, { suspended })
  return NextResponse.json({ success: true })
}
