import { getAdminLevelProposals } from '@/lib/supabase/server'
import AdminProposalsClient from './proposals-client'

export default async function AdminProposalsPage() {
  const proposals = await getAdminLevelProposals()
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-white">Propuestas de nivel</h1>
      <AdminProposalsClient proposals={proposals as Record<string, unknown>[]} />
    </div>
  )
}
