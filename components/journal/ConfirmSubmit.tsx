'use client'

import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'

/**
 * A submit button that asks first, in a dialog that stays put.
 *
 * An earlier version armed the button itself and disarmed on blur or after a
 * few seconds — which made a delete look like it had simply failed. A dialog
 * waits as long as it takes and says plainly what is about to be lost.
 */
interface Props {
  /** What the button says. */
  label: React.ReactNode
  /** Heading of the dialog, e.g. "Delete this entry?". */
  question: string
  /** What will be lost, in a sentence. */
  detail: string
  /** The dialog's go-ahead button. */
  confirmLabel?: string
  className?: string
  title?: string
}

function Confirming({ confirmLabel }: { confirmLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      autoFocus
      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? 'Deleting…' : confirmLabel}
    </button>
  )
}

export default function ConfirmSubmit({
  label,
  question,
  detail,
  confirmLabel = 'Delete',
  className,
  title,
}: Props) {
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (!asking) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAsking(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [asking])

  return (
    <>
      <button
        type="button"
        title={title}
        onClick={() => setAsking(true)}
        className={cn(className)}
      >
        {label}
      </button>

      {asking && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAsking(false)
          }}
        >
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#15121f] p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-white">{question}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{detail}</p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAsking(false)}
                className="rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <Confirming confirmLabel={confirmLabel} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
