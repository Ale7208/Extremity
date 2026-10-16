import { NextResponse } from 'next/server'
import { createAdminClient, isAdmin, getAuthUser, writeAudit } from '@/lib/supabase/server'

/**
 * POST /api/admin/announcements
 * Body: { action: 'create' | 'toggle', ... }
 */
export async function POST(request: Request) {
  const [isAdminResult, authUser] = await Promise.all([isAdmin(), getAuthUser()])
  if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isAdminResult) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const body = await request.json()
  const { action } = body as { action?: string }

  if (action === 'create') {
    const { title, body: annBody, published, sortOrder } = body as {
      title?: string; body?: string; published?: boolean; sortOrder?: number
    }
    if (!title || !annBody) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data, error } = await adminClient.from('announcements').insert({
      title, body: annBody,
      published: published ?? false,
      published_at: published ? new Date().toISOString() : null,
      sort_order: sortOrder ?? 0,
    }).select('id').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAudit(authUser.id, 'create_announcement', 'announcements', data?.id ?? null, { title })
    return NextResponse.json({ success: true })
  }

  if (action === 'toggle') {
    const { announcementId, published } = body as { announcementId?: string; published?: boolean }
    if (!announcementId) return NextResponse.json({ error: 'Missing announcementId' }, { status: 400 })

    const { error } = await adminClient.from('announcements').update({
      published: published ?? false,
      published_at: published ? new Date().toISOString() : null,
    }).eq('id', announcementId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAudit(authUser.id, 'toggle_announcement', 'announcements', announcementId, { published })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
