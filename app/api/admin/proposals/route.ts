import { NextResponse } from 'next/server'
import { createClient, createAdminClient, isAdmin, getAuthUser, writeAudit } from '@/lib/supabase/server'

/**
 * POST /api/admin/proposals
 * Body: { proposalId: string, action: 'approve' | 'reject' }
 */
export async function POST(request: Request) {
  const [isAdminResult, authUser] = await Promise.all([isAdmin(), getAuthUser()])
  if (!authUser) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!isAdminResult) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const admin = createAdminClient()
  const client = admin ?? (await createClient())

  const body = await request.json()
  const { proposalId, action } = body as { proposalId?: string; action?: string }
  if (!proposalId || !action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const { data: proposal } = await client
    .from('level_proposals')
    .select('id, status, proposed_by')
    .eq('id', proposalId)
    .maybeSingle()

  if (!proposal) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
  if (proposal.status !== 'pending') return NextResponse.json({ error: 'La propuesta no está pendiente' }, { status: 400 })

  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  const { error } = await client
    .from('level_proposals')
    .update({
      status: newStatus,
      reviewed_by: authUser.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', proposalId)

  if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

  await writeAudit(authUser.id, `${action}_proposal`, 'level_proposals', proposalId, { status: newStatus })
  return NextResponse.json({ success: true })
}
