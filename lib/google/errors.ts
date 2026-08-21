import { NextResponse } from 'next/server'
import { PickerError } from './picker'

/**
 * Turns a Picker API failure into a response the editor can actually show.
 * The common setup mistakes get a plain-English sentence; anything else falls
 * back to Google's own wording, which is usually specific enough to act on.
 */
export function pickerErrorResponse(err: unknown): NextResponse {
  if (!(err instanceof PickerError)) {
    return NextResponse.json({ error: 'Google Photos request failed' }, { status: 502 })
  }

  if (err.reason === 'SERVICE_DISABLED' || /has not been used in project/.test(err.message)) {
    return NextResponse.json(
      {
        error:
          'The Photos Picker API isn’t enabled for this Google Cloud project yet. Enable it, wait a minute, then try again.',
        helpUrl: err.helpUrl,
      },
      { status: 503 }
    )
  }

  if (err.status === 401 || err.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT') {
    return NextResponse.json(
      {
        error:
          'Google rejected that token. Disconnect and reconnect from Settings → Integrations, making sure the picker scope is granted.',
        helpUrl: err.helpUrl,
      },
      { status: 401 }
    )
  }

  return NextResponse.json(
    { error: err.message, helpUrl: err.helpUrl },
    { status: err.status === 403 ? 403 : 502 }
  )
}
