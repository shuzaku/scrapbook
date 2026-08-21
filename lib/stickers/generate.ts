import React from 'react'
import { renderSticker } from './render'
import SpotifyTopTrackTemplate from './templates/spotify/top_track'
import SteamGamePlayedTemplate from './templates/steam/game_played'
import YouTubeLikedVideoTemplate from './templates/youtube/liked_video'
import type { Event } from '@/lib/supabase/types'

export interface StickerProps {
  title: string
  subtitle: string
  thumbnailUrl?: string
  accentColor?: string
  rank?: number
}

export function eventToStickerProps(event: Event): { templateId: string; props: StickerProps } {
  const base: StickerProps = {
    title: event.display_title ?? 'Untitled',
    subtitle: event.display_subtitle ?? '',
    thumbnailUrl: event.thumbnail_url ?? undefined,
  }

  switch (`${event.provider}:${event.event_type}`) {
    case 'spotify:top_track': {
      const raw = event.raw_data as Record<string, unknown>
      return { templateId: 'spotify:top_track', props: { ...base, accentColor: '#1DB954' } }
    }
    case 'steam:game_played':
      return { templateId: 'steam:game_played', props: { ...base, accentColor: '#4a9eff' } }
    case 'youtube:liked_video':
      return { templateId: 'youtube:liked_video', props: { ...base, accentColor: '#FF0000' } }
    default:
      return { templateId: 'generic', props: base }
  }
}

export async function generateStickerImage(templateId: string, props: StickerProps): Promise<Buffer> {
  let element: React.ReactNode

  switch (templateId) {
    case 'spotify:top_track':
      element = React.createElement(SpotifyTopTrackTemplate, props)
      break
    case 'steam:game_played':
      element = React.createElement(SteamGamePlayedTemplate, props)
      break
    case 'youtube:liked_video':
      element = React.createElement(YouTubeLikedVideoTemplate, props)
      break
    default:
      element = React.createElement('div', {
        style: {
          width: 400, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#1a1a2e', borderRadius: 24, fontFamily: 'Inter', color: '#fff', fontSize: 20,
          padding: 32, textAlign: 'center',
        },
      }, props.title)
  }

  return renderSticker(element)
}
