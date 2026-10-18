import { NextResponse } from 'next/server'
import { createClient, createAdminClient, isAdmin, getAuthUser, writeAudit } from '@/lib/supabase/server'

/**
 * POST /api/admin/identities
 * Body: { identityId: string, action: 'verify' | 'reject' }
 *
 * Admin verifies or rejects a GD identity claim.
 */
export async function POST(request: Request) {
  const [isAdminResult, authUser] = await Promise.all([isAdmin(), getAuthUser()])
  if (!authUser) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!isAdminResult) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const admin = createAdminClient()
  const client = admin ?? (await createClient())

  const body = await request.json()
  const { identityId, action } = body as { identityId?: string; action?: string }
  if (!identityId || !action || !['verify', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const { data: identity } = await client
    .from('gd_identities')
    .select('id, verification_status')
    .eq('id', identityId)
    .maybeSingle()

  if (!identity) return NextResponse.json({ error: 'Identidad no encontrada' }, { status: 404 })
  if (identity.verification_status !== 'pending') {
    return NextResponse.json({ error: 'La identidad no está pendiente' }, { status: 400 })
  }

  const newStatus = action === 'verify' ? 'verified' : 'rejected'
  const { error } = await client
    .from('gd_identities')
    .update({
      verification_status: newStatus,
      verified_at: new Date().toISOString(),
      verified_by: authUser.id,
    })
    .eq('id', identityId)

  if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

  await writeAudit(authUser.id, `${action}_identity`, 'gd_identities', identityId, { verification_status: newStatus })
  return NextResponse.json({ success: true })
}
