import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MOODS, type Entry } from '@/lib/journal/types'

interface Props {
  action: (formData: FormData) => Promise<void>
  entry?: Entry
  /** The book a new entry is being written into. */
  scrapbookId?: string
  /** Used for the date field when composing a new entry. */
  today: string
  submitLabel: string
  cancelHref: string
}

export default function EntryForm({
  action,
  entry,
  scrapbookId,
  today,
  submitLabel,
  cancelHref,
}: Props) {
  return (
    <form action={action} className="space-y-6">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      {scrapbookId && <input type="hidden" name="scrapbookId" value={scrapbookId} />}

      <div className="flex flex-wrap items-end gap-6">
        <div className="space-y-2">
          <label htmlFor="date" className="block text-xs uppercase tracking-widest text-white/50">
            Date
          </label>
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={entry?.date ?? today}
            className="w-44 [color-scheme:dark]"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 block text-xs uppercase tracking-widest text-white/50">
            Mood
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((mood) => (
              <label
                key={mood}
                className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-lg transition-colors hover:bg-white/10 has-[:checked]:border-violet-400 has-[:checked]:bg-violet-500/25"
              >
                <input
                  type="radio"
                  name="mood"
                  value={mood}
                  defaultChecked={entry?.mood === mood}
                  className="sr-only"
                />
                {mood}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="space-y-2">
        <label htmlFor="title" className="block text-xs uppercase tracking-widest text-white/50">
          Title
        </label>
        <Input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={entry?.title}
          placeholder="Ferry ride home"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="body" className="block text-xs uppercase tracking-widest text-white/50">
          Entry
        </label>
        <Textarea
          id="body"
          name="body"
          rows={12}
          maxLength={20000}
          defaultValue={entry?.body}
          placeholder="What happened, what it felt like, what you want to remember…"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="photos" className="block text-xs uppercase tracking-widest text-white/50">
          Photos
        </label>
        <input
          id="photos"
          name="photos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
          className="block w-full cursor-pointer text-sm text-white/60 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/20"
        />
        <p className="text-xs text-white/40">
          JPEG, PNG, GIF, WebP or AVIF — up to 10&nbsp;MB each. Stored locally in{' '}
          <code className="rounded bg-white/10 px-1 py-0.5">.data/uploads</code>.
        </p>
      </div>

      <div className="flex gap-3 border-t border-white/10 pt-6">
        <Button type="submit">{submitLabel}</Button>
        <Link href={cancelHref}>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  )
}
