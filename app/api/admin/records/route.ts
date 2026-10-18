import { NextResponse } from 'next/server'
import { createClient, createAdminClient, isAdmin, getAuthUser, writeAudit } from '@/lib/supabase/server'

/**
 * POST /api/admin/records
 * Body: { recordId: string, action: 'approve' | 'reject' }
 *
 * Server-side authorization:
 * 1. Verifies the user is authenticated and is an admin.
 * 2. Fetches the record to check player_id — blocks self-approval.
 * 3. Updates the record status.
 * 4. Writes an audit log entry.
 */
export async function POST(request: Request) {
  const [isAdminResult, authUser] = await Promise.all([isAdmin(), getAuthUser()])
  if (!authUser) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!isAdminResult) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const admin = createAdminClient()
  const client = admin ?? (await createClient())

  const body = await request.json()
  const { recordId, action } = body as { recordId?: string; action?: string }
  if (!recordId || !action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const { data: record, error: fetchError } = await client
    .from('records')
    .select('id, player_id, status')
    .eq('id', recordId)
    .maybeSingle()

  if (fetchError || !record) {
    return NextResponse.json({ error: 'Récord no encontrado' }, { status: 404 })
  }

  if (record.player_id === authUser.id) {
    return NextResponse.json({ error: 'No puedes aprobar o rechazar tus propios récords' }, { status: 403 })
  }

  if (record.status !== 'pending') {
    return NextResponse.json({ error: 'El récord no está pendiente' }, { status: 400 })
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  const { error: updateError } = await client
    .from('records')
    .update({
      status: newStatus,
      reviewer_id: authUser.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', recordId)

  if (updateError) {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }

  await writeAudit(authUser.id, `${action}_record`, 'records', recordId, { status: newStatus })
  return NextResponse.json({ success: true })
}
