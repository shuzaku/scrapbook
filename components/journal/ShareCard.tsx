import { rotateShareAction, setSharingAction } from '@/lib/journal/actions'
import { Button } from '@/components/ui/button'
import type { ShareState } from '@/lib/journal/store-cloud'

/**
 * Turning a scrapbook into a link.
 *
 * A shared scrapbook is readable by anyone holding its link and nobody else —
 * there is no password on it, so the card says so rather than letting someone
 * assume otherwise.
 */
export default function ShareCard({ id, state, origin }: {
  id: string
  state: ShareState
  /** Where the app is reached, so the link shown is one that works. */
  origin: string
}) {
  const link = state.token ? `${origin}/s/${state.token}` : null

  return (
    <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Share this scrapbook</h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-white/50">
            {state.on
              ? 'Anyone with the link can read it — the entries, the pages and their pictures. There is no password on it.'
              : 'Off. Nobody but you can see this scrapbook.'}
          </p>
        </div>

        <form action={setSharingAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="on" value={state.on ? 'false' : 'true'} />
          <Button type="submit" size="sm" variant={state.on ? 'outline' : 'default'}>
            {state.on ? 'Stop sharing' : 'Share with a link'}
          </Button>
        </form>
      </div>

      {state.on && link && (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
          <p className="overflow-x-auto rounded-lg bg-black/40 px-3 py-2 font-mono text-[13px] text-violet-200">
            {link}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <form action={rotateShareAction}>
              <input type="hidden" name="id" value={id} />
              <Button type="submit" size="sm" variant="ghost">
                Make a new link
              </Button>
            </form>
            <p className="text-[11px] leading-relaxed text-white/35">
              A new link stops the old one working, for anyone you have already sent it to.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
