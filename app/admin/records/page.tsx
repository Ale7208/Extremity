import { getAdminPendingRecords, getAdminAllRecords } from '@/lib/supabase/server'
import AdminRecordsClient from './records-client'

export default async function AdminRecordsPage() {
  const [pending, all] = await Promise.all([
    getAdminPendingRecords(),
    getAdminAllRecords(),
  ])

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-white">Records</h1>
      <AdminRecordsClient pending={pending as Record<string, unknown>[]} all={all as Record<string, unknown>[]} />
    </div>
  )
}
