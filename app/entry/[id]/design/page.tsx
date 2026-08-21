import { notFound } from 'next/navigation'
import CanvasEditor from '@/components/journal/canvas/CanvasEditor'
import { getEntry, getScrapbook } from '@/lib/journal/store'
import { pageSize } from '@/lib/journal/sizes'
import { googleStatus } from '@/lib/google/tokens'
import { isMapsConfigured } from '@/lib/google/maps'
import { spotifyStatus } from '@/lib/spotify/tokens'
import { stravaStatus } from '@/lib/strava/tokens'
import { isAiConfigured } from '@/lib/ai/config'
import { steamStatus } from '@/lib/steam/connection'

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const entry = await getEntry(id)
  if (!entry) notFound()

  const [google, spotify, steam, strava, book] = await Promise.all([
    googleStatus(),
    spotifyStatus(),
    steamStatus(),
    stravaStatus(),
    getScrapbook(entry.scrapbookId),
  ])

  return (
    <CanvasEditor
      entry={entry}
      size={pageSize(book?.pageSize)}
      googleState={google.state}
      mapsConfigured={isMapsConfigured()}
      spotifyState={spotify.state}
      stravaState={strava.state}
      aiConfigured={isAiConfigured()}
      steamState={steam.state}
    />
  )
}
