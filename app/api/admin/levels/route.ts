import { NextResponse } from 'next/server'
import { createAdminClient, isAdmin, getAuthUser, writeAudit } from '@/lib/supabase/server'

/**
 * POST /api/admin/levels
 * Body: { action: 'create' | 'update', ... }
 *
 * Server-side authorization: verifies admin role before any mutation.
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
    const { name, gdLevelId, difficulty, points, published } = body as {
      name?: string; gdLevelId?: number; difficulty?: string; points?: number; published?: boolean
    }
    if (!name || !gdLevelId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data, error } = await adminClient.from('levels').insert({
      name, gd_level_id: gdLevelId,
      difficulty: difficulty ?? 'Unrated', points: points ?? 0,
      published: published ?? false,
    }).select('id').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAudit(authUser.id, 'create_level', 'levels', data?.id ?? null, { name, gd_level_id: gdLevelId })
    return NextResponse.json({ success: true })
  }

  if (action === 'update') {
    const { levelId, field, value } = body as { levelId?: string; field?: string; value?: string | boolean }
    if (!levelId || !field) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const allowedFields = ['name', 'gd_level_id', 'difficulty', 'points', 'published']
    if (!allowedFields.includes(field)) return NextResponse.json({ error: 'Invalid field' }, { status: 400 })

    const updateData: Record<string, unknown> = { [field]: field === 'points' || field === 'gd_level_id' ? Number(value) : value }
    const { error } = await adminClient.from('levels').update(updateData).eq('id', levelId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAudit(authUser.id, 'update_level', 'levels', levelId, { field, value })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
