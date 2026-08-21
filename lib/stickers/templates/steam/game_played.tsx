import React from 'react'

interface Props {
  title: string
  subtitle: string
  thumbnailUrl?: string
  accentColor?: string
}

export default function SteamGamePlayedTemplate({ title, subtitle, thumbnailUrl, accentColor = '#4a9eff' }: Props) {
  return (
    <div
      style={{
        width: 400,
        height: 400,
        display: 'flex',
        flexDirection: 'column',
        background: '#1b2838',
        borderRadius: 24,
        overflow: 'hidden',
        fontFamily: 'Inter',
        position: 'relative',
      }}
    >
      <div style={{ height: 6, background: accentColor, width: '100%', display: 'flex' }} />
      {thumbnailUrl && (
        <div style={{ display: 'flex', width: '100%', height: 200 }}>
          <img src={thumbnailUrl} width={400} height={200} style={{ objectFit: 'cover', width: 400, height: 200 }} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 24px', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', color: accentColor, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
          Steam · Played This Month
        </div>
        <div style={{ display: 'flex', color: '#c6d4df', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
          {title.length > 28 ? title.slice(0, 28) + '…' : title}
        </div>
        <div style={{ display: 'flex', color: '#8f98a0', fontSize: 15 }}>{subtitle}</div>
      </div>
    </div>
  )
}
