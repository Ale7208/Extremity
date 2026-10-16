import RankingsHome, { type Player, type Recent } from '@/components/rankings-home'
import { getPublicData } from '@/lib/supabase/server'

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

  const players: Player[] = rankings?.players ?? []
  const recent: Recent[] = rankings?.recent ?? []

  return (
    <RankingsHome
      players={players}
      recent={recent}
      title={content.site_title ?? '6B Demon List'}
      subtitle={content.site_subtitle ?? 'Class 6B Geometry Dash Rankings'}
      season={content.season_label ?? 'Season 04 / Updated daily'}
      connectionError={connectionError}
    />
  )
}
