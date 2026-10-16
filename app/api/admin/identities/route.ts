import { NextResponse } from 'next/server'
import { createAdminClient, isAdmin, getAuthUser, writeAudit } from '@/lib/supabase/server'

/**
 * POST /api/admin/identities
 * Body: { identityId: string, action: 'verify' | 'reject' }
 *
 * Admin verifies or rejects a GD identity claim.
 */
export async function POST(request: Request) {
  const [isAdminResult, authUser] = await Promise.all([isAdmin(), getAuthUser()])
  if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isAdminResult) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const body = await request.json()
  const { identityId, action } = body as { identityId?: string; action?: string }
  if (!identityId || !action || !['verify', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: identity } = await adminClient
    .from('gd_identities')
    .select('id, verification_status')
    .eq('id', identityId)
    .maybeSingle()

  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
  if (identity.verification_status !== 'pending') {
    return NextResponse.json({ error: 'Identity is not pending' }, { status: 400 })
  }

  const newStatus = action === 'verify' ? 'verified' : 'rejected'
  const { error } = await adminClient
    .from('gd_identities')
    .update({
      verification_status: newStatus,
      verified_at: new Date().toISOString(),
      verified_by: authUser.id,
    })
    .eq('id', identityId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAudit(authUser.id, `${action}_identity`, 'gd_identities', identityId, { verification_status: newStatus })
  return NextResponse.json({ success: true })
}
