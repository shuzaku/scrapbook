/**
 * Reading the moment a photo was taken.
 *
 * Server-only: this pulls in sharp, a native module. Client components want
 * `takenOnDate` from ./dates instead.
 *
 * EXIF timestamps carry no timezone — they're the wall clock on the camera —
 * so the parsed value is kept as-is rather than shifted into the server's
 * timezone, which could move a photo onto the wrong day.
 */
import sharp from 'sharp'
import exifReader from 'exif-reader'

/** ISO timestamp of when the photo was taken, or null if it doesn't say. */
export async function takenAtFromImage(bytes: Buffer): Promise<string | null> {
  try {
    const { exif } = await sharp(bytes).metadata()
    if (!exif) return null

    const parsed = exifReader(exif)
    const taken =
      parsed?.Photo?.DateTimeOriginal ??
      parsed?.Photo?.DateTimeDigitized ??
      parsed?.Image?.DateTime

    if (!(taken instanceof Date) || Number.isNaN(taken.getTime())) return null
    return taken.toISOString()
  } catch {
    // A corrupt or unreadable header shouldn't stop a photo being saved.
    return null
  }
}
