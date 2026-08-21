import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createSession } from '@/lib/google/picker'
import { pickerErrorResponse } from '@/lib/google/errors'
import { getAccessToken } from '@/lib/google/tokens'

/**
 * Opens a picker session.
 *
 * Google won't let its picker render in a frame, so the app can't host it
 * directly. What it can host is the hand-off: a QR code to pick on a phone
 * while staying on this page, or a same-device link that closes itself again.
 */
export async function POST() {
  const token = await getAccessToken()
  if (!token) {
    return NextResponse.json({ error: 'Not connected to Google Photos' }, { status: 401 })
  }

  try {
    const session = await createSession(token)

    // Google closes its own window after picking when the URI ends /autoclose.
    const sameDeviceUri = `${session.pickerUri.replace(/\/$/, '')}/autoclose`

    const qrSvg = await QRCode.toString(session.pickerUri, {
      type: 'svg',
      margin: 1,
      width: 240,
      color: { dark: '#1c1a2e', light: '#ffffff' },
    })

    return NextResponse.json({
      sessionId: session.id,
      pickerUri: session.pickerUri,
      sameDeviceUri,
      qrSvg,
      pollInterval: session.pollInterval,
    })
  } catch (err) {
    console.error('[google] creating a picker session failed', err)
    return pickerErrorResponse(err)
  }
}
