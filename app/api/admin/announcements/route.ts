import { NextResponse } from 'next/server'
import { createClient, createAdminClient, isAdmin, getAuthUser, writeAudit } from '@/lib/supabase/server'

/**
 * POST /api/admin/announcements
 * Body: { action: 'create' | 'toggle', ... }
 */
export async function POST(request: Request) {
  const [isAdminResult, authUser] = await Promise.all([isAdmin(), getAuthUser()])
  if (!authUser) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!isAdminResult) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const admin = createAdminClient()
  const client = admin ?? (await createClient())

  const body = await request.json()
  const { action } = body as { action?: string }

  if (action === 'create') {
    const { title, body: annBody, published, sortOrder } = body as {
      title?: string; body?: string; published?: boolean; sortOrder?: number
    }
    if (!title || !annBody) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

    const { data, error } = await client.from('announcements').insert({
      title, body: annBody,
      published: published ?? false,
      published_at: published ? new Date().toISOString() : null,
      sort_order: sortOrder ?? 0,
    }).select('id').single()

    if (error) return NextResponse.json({ error: 'Error al crear anuncio' }, { status: 500 })

    await writeAudit(authUser.id, 'create_announcement', 'announcements', data?.id ?? null, { title })
    return NextResponse.json({ success: true })
  }

  if (action === 'toggle') {
    const { announcementId, published } = body as { announcementId?: string; published?: boolean }
    if (!announcementId) return NextResponse.json({ error: 'Falta announcementId' }, { status: 400 })

    const { error } = await client.from('announcements').update({
      published: published ?? false,
      published_at: published ? new Date().toISOString() : null,
    }).eq('id', announcementId)

    if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

    await writeAudit(authUser.id, 'toggle_announcement', 'announcements', announcementId, { published })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}
