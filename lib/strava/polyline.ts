/**
 * Turning a Strava route into a drawing.
 *
 * Every activity carries its shape as an encoded polyline — Google's format,
 * a compact string of deltas. Decoded and projected, it becomes an SVG path,
 * which means a route can go on a page as vector art: no map tiles, no API
 * key, no image to download, and it stays sharp at any size.
 */

export interface Point {
  lat: number
  lon: number
}

/** Encoded polylines are printable ASCII; anything else isn't one. */
const ENCODED = /^[\x3f-\x7e\\]*$/

export function isPolyline(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 20_000 && ENCODED.test(value)
}

/**
 * Decodes Google's encoded polyline.
 *
 * Each coordinate is a zigzag-encoded delta from the last, split into
 * five-bit chunks with a continuation flag, offset by 63 into printable
 * characters.
 */
export function decode(encoded: string, precision = 5): Point[] {
  if (!isPolyline(encoded) || !encoded) return []

  const factor = 10 ** precision
  const points: Point[] = []

  let index = 0
  let lat = 0
  let lon = 0

  /**
   * Reads one zigzag-encoded delta: five-bit chunks with a continuation flag,
   * offset by 63 into printable characters. Returns null if the string runs
   * out mid-value, which means the polyline was truncated.
   */
  const readDelta = (): number | null => {
    let result = 0
    let shift = 0

    for (;;) {
      if (index >= encoded.length) return null

      const byte = encoded.charCodeAt(index++) - 63
      if (byte < 0) return null

      result |= (byte & 0x1f) << shift
      shift += 5
      if (byte < 0x20) break
    }

    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    const dLat = readDelta()
    if (dLat === null) break

    const dLon = readDelta()
    // A half-read coordinate is dropped rather than landing the route at
    // Null Island and dragging the whole drawing with it.
    if (dLon === null) break

    lat += dLat
    lon += dLon
    points.push({ lat: lat / factor, lon: lon / factor })
  }

  return points
}

/**
 * Projects a route into an SVG path that fills the given box.
 *
 * Latitude is flipped, since SVG counts downwards, and longitude is squeezed
 * by the cosine of the latitude — without that a route in Houston or Helsinki
 * comes out visibly stretched sideways. The shape keeps its proportions and
 * sits centred, whatever the box.
 */
export function toPath(points: Point[], width: number, height: number, padding = 6): string {
  if (points.length < 2) return ''

  const mid = points[Math.floor(points.length / 2)].lat
  const squeeze = Math.cos((mid * Math.PI) / 180) || 1

  const xs = points.map((p) => p.lon * squeeze)
  const ys = points.map((p) => -p.lat)

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const spanX = maxX - minX
  const spanY = maxY - minY
  // A there-and-back on one street has almost no width; guard the divide.
  if (spanX === 0 && spanY === 0) return ''

  const usableW = Math.max(width - padding * 2, 1)
  const usableH = Math.max(height - padding * 2, 1)
  const scale = Math.min(spanX ? usableW / spanX : Infinity, spanY ? usableH / spanY : Infinity)

  // Centred in whatever room is left over.
  const offsetX = padding + (usableW - spanX * scale) / 2
  const offsetY = padding + (usableH - spanY * scale) / 2

  const round = (n: number) => Math.round(n * 10) / 10

  return points
    .map((point, at) => {
      const x = round((point.lon * squeeze - minX) * scale + offsetX)
      const y = round((-point.lat - minY) * scale + offsetY)
      return `${at === 0 ? 'M' : 'L'}${x} ${y}`
    })
    .join(' ')
}

/**
 * Thins a route down before drawing.
 *
 * A long ride can carry thousands of points, which makes for an enormous path
 * and no visible difference at sticker size.
 */
export function simplify(points: Point[], most = 400): Point[] {
  if (points.length <= most) return points

  const step = points.length / most
  const kept: Point[] = []
  for (let at = 0; at < most; at += 1) kept.push(points[Math.floor(at * step)])

  // The finish matters — dropping it leaves a route that stops early.
  const last = points[points.length - 1]
  if (kept[kept.length - 1] !== last) kept.push(last)
  return kept
}
