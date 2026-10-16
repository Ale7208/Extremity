import { NextResponse } from 'next/server'
import { createAdminClient, isAdmin, getAuthUser, writeAudit } from '@/lib/supabase/server'

/**
 * POST /api/admin/content
 * Body: { key: string, action: 'toggle', published: boolean }
 */
export async function POST(request: Request) {
  const [isAdminResult, authUser] = await Promise.all([isAdmin(), getAuthUser()])
  if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isAdminResult) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const body = await request.json()
  const { key, action, published } = body as { key?: string; action?: string; published?: boolean }
  if (!key || action !== 'toggle') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { error } = await adminClient.from('site_content').update({
    published: published ?? false,
  }).eq('key', key)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAudit(authUser.id, 'toggle_content', 'site_content', null, { key, published })
  return NextResponse.json({ success: true })
}
