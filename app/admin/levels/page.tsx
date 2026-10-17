import { getAdminLevels } from '@/lib/supabase/server'
import AdminLevelsClient from './levels-client'

export default async function AdminLevelsPage() {
  const levels = await getAdminLevels()
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-white">Niveles</h1>
      <AdminLevelsClient levels={levels as Record<string, unknown>[]} />
    </div>
  )
}
