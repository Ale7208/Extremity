import { NextResponse } from 'next/server'
import { createClient, createAdminClient, isAdmin, getAuthUser, writeAudit } from '@/lib/supabase/server'

/**
 * POST /api/admin/content
 * Body: { key: string, action: 'toggle', published: boolean }
 */
export async function POST(request: Request) {
  const [isAdminResult, authUser] = await Promise.all([isAdmin(), getAuthUser()])
  if (!authUser) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!isAdminResult) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const admin = createAdminClient()
  const client = admin ?? (await createClient())

  const body = await request.json()
  const { key, action, published } = body as { key?: string; action?: string; published?: boolean }
  if (!key || action !== 'toggle') return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })

  const { error } = await client.from('site_content').update({
    published: published ?? false,
  }).eq('key', key)

  if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

  await writeAudit(authUser.id, 'toggle_content', 'site_content', null, { key, published })
  return NextResponse.json({ success: true })
}
