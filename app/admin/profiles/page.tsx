import { getAdminProfiles } from '@/lib/supabase/server'
import AdminProfilesClient from './profiles-client'

export default async function AdminProfilesPage() {
  const profiles = await getAdminProfiles()
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-white">Perfiles</h1>
      <AdminProfilesClient profiles={profiles as Record<string, unknown>[]} />
    </div>
  )
}
