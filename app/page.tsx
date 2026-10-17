import RankingsHome, { type Player, type Recent } from '@/components/rankings-home'
import { getPublicData, getAuthUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Home() {
  let rankings = null
  let content: Record<string, string> = {}
  let connectionError = false

  try {
    const [rankingsData, contentData] = await getPublicData()
    rankings = rankingsData
    content = contentData
  } catch {
    connectionError = true
  }

  let user = null
  try {
    user = await getAuthUser()
  } catch {
    // cookies() not available (e.g. during prerender) — render as visitor
  }
  const isAdmin = user?.app_metadata?.['role'] === 'admin'

  const players: Player[] = rankings?.players ?? []
  const recent: Recent[] = rankings?.recent ?? []

  return (
    <RankingsHome
      players={players}
      recent={recent}
      title={content.site_title ?? 'Extremity List'}
      subtitle={content.site_subtitle ?? 'Extremity Geometry Dash Rankings'}
      season={content.season_label ?? 'Season 04 / Updated daily'}
      connectionError={connectionError}
      isLoggedIn={!!user}
      isAdmin={isAdmin}
    />
  )
}
