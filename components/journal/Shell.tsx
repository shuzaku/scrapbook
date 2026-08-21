import Link from 'next/link'
import { Button } from '@/components/ui/button'

/** Page frame shared by every journal screen. */
export default function Shell({
  children,
  action,
  crumb,
}: {
  children: React.ReactNode
  action?: React.ReactNode
  /** Where "up" goes, shown after the wordmark. */
  crumb?: { href: string; label: string }
}) {
  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 60%, #0a1a2e 100%)' }}
    >
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold text-white">
              <span>📖</span> Scrapbook
            </Link>
            {crumb && (
              <>
                <span className="text-white/25">/</span>
                <Link
                  href={crumb.href}
                  className="truncate text-sm text-white/60 transition-colors hover:text-white"
                >
                  {crumb.label}
                </Link>
              </>
            )}
          </div>
          {action ?? (
            <Link href="/book/new">
              <Button size="sm">New scrapbook</Button>
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  )
}
