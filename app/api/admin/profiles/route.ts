import { NextResponse } from 'next/server'
import { createClient, createAdminClient, isAdmin, getAuthUser, writeAudit } from '@/lib/supabase/server'

/**
 * POST /api/admin/profiles
 * Body: { profileId: string, action: 'suspend' | 'unsuspend' }
 */
export async function POST(request: Request) {
  const [isAdminResult, authUser] = await Promise.all([isAdmin(), getAuthUser()])
  if (!authUser) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!isAdminResult) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const admin = createAdminClient()
  const client = admin ?? (await createClient())

  const body = await request.json()
  const { profileId, action } = body as { profileId?: string; action?: string }
  if (!profileId || !action || !['suspend', 'unsuspend'].includes(action)) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const suspended = action === 'suspend'
  const { error } = await client
    .from('profiles')
    .update({ suspended })
    .eq('id', profileId)

  if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

  await writeAudit(authUser.id, `${action}_profile`, 'profiles', profileId, { suspended })
  return NextResponse.json({ success: true })
}
