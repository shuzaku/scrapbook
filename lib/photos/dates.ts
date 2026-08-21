/**
 * Pure helpers for capture dates. Safe to import from a Client Component —
 * deliberately kept apart from the EXIF reader, which needs Node's sharp.
 */

/** The yyyy-MM-dd a photo belongs to, read off the wall clock, not local time. */
export function takenOnDate(takenAt: string): string {
  return takenAt.slice(0, 10)
}

/**
 * The capture time as a Date that formats back to the numbers the camera
 * recorded. EXIF has no timezone, so the stored ISO string only *looks* like
 * UTC — rendering it in local time would shift the clock, and near midnight
 * the day with it.
 */
export function wallClock(takenAt: string): Date {
  return new Date(takenAt.replace(/Z$/, ''))
}
