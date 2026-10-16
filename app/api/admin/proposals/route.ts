import { NextResponse } from 'next/server'
import { createAdminClient, isAdmin, getAuthUser, writeAudit } from '@/lib/supabase/server'

/**
 * POST /api/admin/proposals
 * Body: { proposalId: string, action: 'approve' | 'reject' }
 *
 * Approving a proposal triggers the database trigger (promote_level_proposal)
 * which creates a new level and relinks records. The API only sets status.
 */
export async function POST(request: Request) {
  const [isAdminResult, authUser] = await Promise.all([isAdmin(), getAuthUser()])
  if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isAdminResult) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const body = await request.json()
  const { proposalId, action } = body as { proposalId?: string; action?: string }
  if (!proposalId || !action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: proposal } = await adminClient
    .from('level_proposals')
    .select('id, status, proposed_by')
    .eq('id', proposalId)
    .maybeSingle()

  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  if (proposal.status !== 'pending') return NextResponse.json({ error: 'Proposal is not pending' }, { status: 400 })

  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  const { error } = await adminClient
    .from('level_proposals')
    .update({
      status: newStatus,
      reviewed_by: authUser.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', proposalId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAudit(authUser.id, `${action}_proposal`, 'level_proposals', proposalId, { status: newStatus })
  return NextResponse.json({ success: true })
}
