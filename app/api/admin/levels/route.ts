import { NextResponse } from 'next/server'
import { createClient, createAdminClient, isAdmin, getAuthUser, writeAudit } from '@/lib/supabase/server'

/**
 * POST /api/admin/levels
 * Body: { action: 'create' | 'update', ... }
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
    const { name, gdLevelId, difficulty, points, published } = body as {
      name?: string; gdLevelId?: number; difficulty?: string; points?: number; published?: boolean
    }
    if (!name || !gdLevelId) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

    const { data, error } = await client.from('levels').insert({
      name, gd_level_id: gdLevelId,
      difficulty: difficulty ?? 'Unrated', points: points ?? 0,
      published: published ?? false,
    }).select('id').single()

    if (error) return NextResponse.json({ error: 'Error al crear nivel' }, { status: 500 })

    await writeAudit(authUser.id, 'create_level', 'levels', data?.id ?? null, { name, gd_level_id: gdLevelId })
    return NextResponse.json({ success: true })
  }

  if (action === 'update') {
    const { levelId, field, value } = body as { levelId?: string; field?: string; value?: string | boolean }
    if (!levelId || !field) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

    const allowedFields = ['name', 'gd_level_id', 'difficulty', 'points', 'published']
    if (!allowedFields.includes(field)) return NextResponse.json({ error: 'Campo inválido' }, { status: 400 })

    const updateData: Record<string, unknown> = { [field]: field === 'points' || field === 'gd_level_id' ? Number(value) : value }
    const { error } = await client.from('levels').update(updateData).eq('id', levelId)
    if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

    await writeAudit(authUser.id, 'update_level', 'levels', levelId, { field, value })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}
