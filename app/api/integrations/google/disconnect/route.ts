import { NextResponse, type NextRequest } from 'next/server'
import { revoke } from '@/lib/google/oauth'
import { clearConnection, getAccessToken } from '@/lib/google/tokens'

/** Drops the stored tokens and tells Google to forget the grant. */
export async function POST(request: NextRequest) {
  const token = await getAccessToken()
  if (token) await revoke(token)
  await clearConnection()

  return NextResponse.redirect(new URL('/settings/integrations?google=disconnected', request.url), {
    status: 303,
  })
}
