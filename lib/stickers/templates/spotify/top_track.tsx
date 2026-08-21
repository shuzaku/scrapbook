import React from 'react'

interface Props {
  title: string
  subtitle: string
  thumbnailUrl?: string
  accentColor?: string
  rank?: number
}

export default function SpotifyTopTrackTemplate({ title, subtitle, thumbnailUrl, accentColor = '#1DB954', rank }: Props) {
  return (
    <div
      style={{
        width: 400,
        height: 400,
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a0a',
        borderRadius: 24,
        overflow: 'hidden',
        fontFamily: 'Inter',
        position: 'relative',
      }}
    >
      {/* Accent bar */}
      <div style={{ height: 6, background: accentColor, width: '100%', display: 'flex' }} />

      {/* Album art */}
      {thumbnailUrl && (
        <div style={{ display: 'flex', width: '100%', height: 200, overflow: 'hidden' }}>
          <img src={thumbnailUrl} width={400} height={200} style={{ objectFit: 'cover', width: 400, height: 200 }} />
        </div>
      )}

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 24px', gap: 8, flex: 1 }}>
        {rank && (
          <div style={{ display: 'flex', color: accentColor, fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
            #{rank} Top Track
          </div>
        )}
        <div style={{ display: 'flex', color: '#ffffff', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
          {title.length > 28 ? title.slice(0, 28) + '…' : title}
        </div>
        <div style={{ display: 'flex', color: '#a0a0a0', fontSize: 15 }}>
          {subtitle.length > 36 ? subtitle.slice(0, 36) + '…' : subtitle}
        </div>
      </div>

      {/* Spotify badge */}
      <div style={{ position: 'absolute', bottom: 16, right: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: accentColor, display: 'flex' }} />
        <span style={{ color: '#606060', fontSize: 12, display: 'flex' }}>Spotify</span>
      </div>
    </div>
  )
}
