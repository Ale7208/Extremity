import { NextResponse } from 'next/server'
import { createClient, createAdminClient, isAdmin, getAuthUser, writeAudit } from '@/lib/supabase/server'

/**
 * POST /api/admin/records
 * Body: { recordId: string, action: 'approve' | 'reject' }
 *
 * Server-side authorization:
 * 1. Verifies the user is authenticated and has app_metadata.role = 'admin'.
 * 2. Fetches the record to check player_id — blocks self-approval.
 * 3. Uses the admin client (service role key) to update the record.
 * 4. Writes an audit log entry.
 */
export async function POST(request: Request) {
  const admin = isAdmin()
  const user = getAuthUser()
  const [isAdminResult, authUser] = await Promise.all([admin, user])

  if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isAdminResult) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'Server not configured for admin operations' }, { status: 500 })

  const body = await request.json()
  const { recordId, action } = body as { recordId?: string; action?: string }
  if (!recordId || !action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Fetch the record to check ownership (prevent self-approval)
  const { data: record, error: fetchError } = await adminClient
    .from('records')
    .select('id, player_id, status')
    .eq('id', recordId)
    .maybeSingle()

  if (fetchError || !record) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  if (record.player_id === authUser.id) {
    return NextResponse.json({ error: 'You cannot approve or reject your own records' }, { status: 403 })
  }

  if (record.status !== 'pending') {
    return NextResponse.json({ error: 'Record is not pending' }, { status: 400 })
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  const { error: updateError } = await adminClient
    .from('records')
    .update({
      status: newStatus,
      reviewer_id: authUser.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', recordId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await writeAudit(authUser.id, `${action}_record`, 'records', recordId, { status: newStatus })

  return NextResponse.json({ success: true })
}
