import { getAdminAllAnnouncements, getAdminContentRows, getAdminSettings } from '@/lib/supabase/server'
import AdminContentClient from './content-client'

export default async function AdminContentPage() {
  const [announcements, content, settings] = await Promise.all([
    getAdminAllAnnouncements(),
    getAdminContentRows(),
    getAdminSettings(),
  ])

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-white">Contenido y configuración</h1>
      <AdminContentClient
        announcements={announcements as Record<string, unknown>[]}
        content={content as Record<string, unknown>[]}
        settings={settings as Record<string, unknown>[]}
      />
    </div>
  )
}
