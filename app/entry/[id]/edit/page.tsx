import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import Shell from '@/components/journal/Shell'
import EntryForm from '@/components/journal/EntryForm'
import { removePhotoAction, updateEntryAction } from '@/lib/journal/actions'
import { getEntry } from '@/lib/journal/store'

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const entry = await getEntry(id)
  if (!entry) notFound()

  return (
    <Shell
      crumb={{ href: `/entry/${entry.id}`, label: entry.title }}
      action={<span className="text-sm text-white/40">Editing</span>}
    >
      <h1 className="mb-8 text-2xl font-bold text-white">Edit entry</h1>

      {entry.photos.length > 0 && (
        <section className="mb-8">
          <p className="mb-3 text-xs uppercase tracking-widest text-white/50">Photos on this page</p>
          <div className="flex flex-wrap gap-3">
            {entry.photos.map((photo) => (
              <div key={photo.name} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos */}
                <img
                  src={`/api/photos/${photo.name}`}
                  alt={photo.caption ?? ''}
                  className="h-24 w-24 rounded-lg border border-white/10 object-cover"
                />
                <form action={removePhotoAction}>
                  <input type="hidden" name="id" value={entry.id} />
                  <input type="hidden" name="photo" value={photo.name} />
                  <button
                    type="submit"
                    aria-label="Remove photo"
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-[#1a0a2e] text-xs text-white/70 transition-colors hover:bg-red-600 hover:text-white"
                  >
                    ✕
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      <EntryForm
        action={updateEntryAction}
        entry={entry}
        today={format(new Date(), 'yyyy-MM-dd')}
        submitLabel="Save changes"
        cancelHref={`/entry/${entry.id}`}
      />
    </Shell>
  )
}
