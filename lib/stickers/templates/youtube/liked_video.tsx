import React from 'react'

interface Props {
  title: string
  subtitle: string
  thumbnailUrl?: string
  accentColor?: string
}

export default function YouTubeLikedVideoTemplate({ title, subtitle, thumbnailUrl, accentColor = '#FF0000' }: Props) {
  return (
    <div
      style={{
        width: 400,
        height: 400,
        display: 'flex',
        flexDirection: 'column',
        background: '#0f0f0f',
        borderRadius: 24,
        overflow: 'hidden',
        fontFamily: 'Inter',
        position: 'relative',
      }}
    >
      <div style={{ height: 6, background: accentColor, width: '100%', display: 'flex' }} />
      {thumbnailUrl && (
        <div style={{ display: 'flex', width: '100%', height: 200, position: 'relative' }}>
          <img src={thumbnailUrl} width={400} height={200} style={{ objectFit: 'cover', width: 400, height: 200 }} />
          <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.8)', borderRadius: 4, padding: '2px 6px', display: 'flex' }}>
            <span style={{ color: '#fff', fontSize: 11, display: 'flex' }}>♥ Liked</span>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 24px', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', color: accentColor, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
          YouTube · Liked Video
        </div>
        <div style={{ display: 'flex', color: '#f1f1f1', fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>
          {title.length > 50 ? title.slice(0, 50) + '…' : title}
        </div>
        <div style={{ display: 'flex', color: '#aaaaaa', fontSize: 14 }}>{subtitle}</div>
      </div>
    </div>
  )
}
