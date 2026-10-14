import RankingsHome, { fallbackPlayers, fallbackRecent, type Player, type Recent } from '@/components/rankings-home'
import { getPublicData } from '@/lib/supabase/server'

export default async function Home() {
  const [rankings, content] = await getPublicData()
  const players: Player[] = rankings?.players?.length ? rankings.players : fallbackPlayers
  const recent: Recent[] = rankings?.recent?.length ? rankings.recent : fallbackRecent
  return <RankingsHome players={players} recent={recent} title={content.site_title ?? '6B Demon List'} subtitle={content.site_subtitle ?? 'Class 6B Geometry Dash Rankings'} season={content.season_label ?? 'Season 04 / Updated daily'} />
}
