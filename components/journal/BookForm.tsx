import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { COVER_COLORS, COVER_EMOJIS, DEFAULT_COVER } from '@/lib/journal/books'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, sizeLabel } from '@/lib/journal/sizes'
import type { Scrapbook } from '@/lib/journal/types'

interface Props {
  action: (formData: FormData) => Promise<void>
  book?: Scrapbook
  submitLabel: string
  cancelHref: string
}

export default function BookForm({ action, book, submitLabel, cancelHref }: Props) {
  const color = book?.cover.color ?? DEFAULT_COVER.color
  const emoji = book?.cover.emoji ?? DEFAULT_COVER.emoji

  return (
    <form action={action} className="space-y-6">
      {book && <input type="hidden" name="id" value={book.id} />}

      <div className="space-y-2">
        <label htmlFor="title" className="block text-xs uppercase tracking-widest text-white/50">
          Name
        </label>
        <Input
          id="title"
          name="title"
          required
          maxLength={120}
          defaultValue={book?.title}
          placeholder="Summer on the coast"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="subtitle" className="block text-xs uppercase tracking-widest text-white/50">
          Subtitle
        </label>
        <Input
          id="subtitle"
          name="subtitle"
          maxLength={200}
          defaultValue={book?.subtitle}
          placeholder="Optional — a line for the shelf"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 block text-xs uppercase tracking-widest text-white/50">
          Page size
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAGE_SIZES.map((option) => (
            <label
              key={option.key}
              className="flex cursor-pointer gap-3 rounded-lg border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10 has-[:checked]:border-violet-400 has-[:checked]:bg-violet-500/15"
            >
              <input
                type="radio"
                name="pageSize"
                value={option.key}
                defaultChecked={(book?.pageSize ?? DEFAULT_PAGE_SIZE) === option.key}
                className="sr-only"
              />
              {/* A scaled silhouette of the real page, so the shapes compare. */}
              <span
                className="mt-0.5 shrink-0 self-start rounded-[2px] border border-white/25 bg-white/10"
                style={{
                  width: option.inches[0] * 3.4,
                  height: option.inches[1] * 3.4,
                }}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm text-white/85">{option.label}</span>
                <span className="block text-xs text-white/40">{sizeLabel(option)}</span>
                <span className="mt-1 block text-xs leading-relaxed text-white/45">
                  {option.blurb}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 block text-xs uppercase tracking-widest text-white/50">
          Cover colour
        </legend>
        <div className="flex flex-wrap gap-2">
          {COVER_COLORS.map((option) => (
            <label
              key={option}
              className="h-9 w-9 cursor-pointer rounded-full border-2 border-white/20 transition-transform hover:scale-110 has-[:checked]:border-violet-300 has-[:checked]:ring-2 has-[:checked]:ring-violet-400/60"
              style={{ backgroundColor: option }}
            >
              <input
                type="radio"
                name="color"
                value={option}
                defaultChecked={option === color}
                className="sr-only"
              />
              <span className="sr-only">{option}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 block text-xs uppercase tracking-widest text-white/50">
          Cover mark
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {COVER_EMOJIS.map((option) => (
            <label
              key={option}
              className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-lg transition-colors hover:bg-white/10 has-[:checked]:border-violet-400 has-[:checked]:bg-violet-500/25"
            >
              <input
                type="radio"
                name="emoji"
                value={option}
                defaultChecked={option === emoji}
                className="sr-only"
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>

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
