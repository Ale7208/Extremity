import { getAdminGdIdentities } from '@/lib/supabase/server'
import AdminIdentitiesClient from './identities-client'

export default async function AdminIdentitiesPage() {
  const identities = await getAdminGdIdentities()
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-white">GD identities</h1>
      <AdminIdentitiesClient identities={identities as Record<string, unknown>[]} />
    </div>
  )
}
