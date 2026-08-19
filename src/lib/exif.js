// Reads the two things a phone photo already knows about a moment: when it was
// taken, and where.
//
// Hand-rolled rather than a dependency because only two tags are wanted and the
// failure mode is benign — anything unrecognised returns nulls and the form is
// simply not prefilled. Nothing here throws into the caller.
//
// Layout, for anyone maintaining this: a JPEG is SOI (FFD8) followed by marker
// segments, each a 2-byte marker and a 2-byte big-endian length. EXIF rides in
// APP1 (FFE1), whose payload starts "Exif\0\0" and is followed by a TIFF
// header. TIFF gives the byte order for everything after it, so nothing below
// can assume little-endian.

const EMPTY = { date: null, lat: null, lng: null }

// EXIF lives near the front of the file. Reading a slice keeps a 12MP photo
// off the main thread's memory for the sake of a timestamp.
const MAX_SCAN = 256 * 1024

// TIFF tags
const TAG_DATETIME = 0x0132          // IFD0, fallback
const TAG_EXIF_IFD = 0x8769
const TAG_GPS_IFD = 0x8825
const TAG_DATETIME_ORIGINAL = 0x9003 // when the shutter fired — the one we want
const TAG_DATETIME_DIGITIZED = 0x9004
const TAG_GPS_LAT_REF = 0x0001
const TAG_GPS_LAT = 0x0002
const TAG_GPS_LNG_REF = 0x0003
const TAG_GPS_LNG = 0x0004

// Bytes per component, indexed by TIFF type.
const TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }

/** Byte offset of the TIFF header inside an EXIF APP1 segment, or -1. */
function findTiffStart(view) {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return -1

  let off = 2
  while (off + 4 <= view.byteLength) {
    const marker = view.getUint16(off)
    // Anything not starting FF means we've lost the segment chain.
    if ((marker & 0xff00) !== 0xff00) return -1
    // Start of Scan: image data from here on, no more metadata.
    if (marker === 0xffda) return -1

    const size = view.getUint16(off + 2)
    if (size < 2) return -1

    if (marker === 0xffe1) {
      const payload = off + 4
      // "Exif" then two zero bytes.
      if (payload + 6 <= view.byteLength &&
          view.getUint32(payload) === 0x45786966 &&
          view.getUint16(payload + 4) === 0x0000) {
        return payload + 6
      }
    }
    off += 2 + size
  }
  return -1
}

/** Read one IFD into a Map of tag → { type, count, offset }. */
function readIfd(view, tiff, ifdOffset, le) {
  const out = new Map()
  if (ifdOffset + 2 > view.byteLength) return out

  const count = view.getUint16(ifdOffset, le)
  for (let i = 0; i < count; i++) {
    const entry = ifdOffset + 2 + i * 12
    if (entry + 12 > view.byteLength) break

    const tag = view.getUint16(entry, le)
    const type = view.getUint16(entry + 2, le)
    const n = view.getUint32(entry + 4, le)
    const size = (TYPE_SIZES[type] || 0) * n

    // Values of four bytes or fewer sit in the entry itself; anything larger
    // is an offset measured from the start of the TIFF header, not the file.
    const offset = size > 4 ? tiff + view.getUint32(entry + 8, le) : entry + 8
    out.set(tag, { type, count: n, offset })
  }
  return out
}

function readAscii(view, entry) {
  if (entry.type !== 2) return null
  let s = ''
  for (let i = 0; i < entry.count; i++) {
    if (entry.offset + i >= view.byteLength) break
    const c = view.getUint8(entry.offset + i)
    if (c === 0) break
    s += String.fromCharCode(c)
  }
  return s || null
}

/** RATIONAL values are a pair of longs; return them already divided. */
function readRationals(view, entry, le) {
  if (entry.type !== 5 && entry.type !== 10) return null
  const out = []
  for (let i = 0; i < entry.count; i++) {
    const at = entry.offset + i * 8
    if (at + 8 > view.byteLength) return null
    const num = entry.type === 10 ? view.getInt32(at, le) : view.getUint32(at, le)
    const den = entry.type === 10 ? view.getInt32(at + 4, le) : view.getUint32(at + 4, le)
    if (!den) return null
    out.push(num / den)
  }
  return out
}

/** Degrees/minutes/seconds triple → signed decimal degrees. */
function dmsToDecimal(dms, ref) {
  if (!dms || dms.length < 3) return null
  const [d, m, s] = dms
  let value = d + m / 60 + s / 3600
  if (ref === 'S' || ref === 'W') value = -value
  return value
}

/** EXIF stores "YYYY:MM:DD HH:MM:SS" in local time. Keep the calendar day. */
function toDateOnly(raw) {
  if (!raw || raw.length < 10) return null
  const date = raw.slice(0, 10).replace(/:/g, '-')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  // A camera with a dead clock writes zeroes; that isn't a date.
  if (date.startsWith('0000')) return null
  return date
}

/**
 * Pull the capture date and coordinates out of an image file.
 * Always resolves; returns nulls for anything it can't read.
 *
 * @returns {Promise<{ date: string|null, lat: number|null, lng: number|null }>}
 */
export async function readPhotoMeta(file) {
  try {
    const buf = await file.slice(0, MAX_SCAN).arrayBuffer()
    const view = new DataView(buf)

    const tiff = findTiffStart(view)
    if (tiff < 0 || tiff + 8 > view.byteLength) return EMPTY

    const order = view.getUint16(tiff)
    const le = order === 0x4949            // "II" little-endian, "MM" big-endian
    if (!le && order !== 0x4d4d) return EMPTY
    if (view.getUint16(tiff + 2, le) !== 0x002a) return EMPTY

    const ifd0 = readIfd(view, tiff, tiff + view.getUint32(tiff + 4, le), le)

    // Date: prefer when the shutter fired over when the file was written.
    let date = null
    const exifPtr = ifd0.get(TAG_EXIF_IFD)
    if (exifPtr) {
      const exifIfd = readIfd(view, tiff, tiff + view.getUint32(exifPtr.offset, le), le)
      date = toDateOnly(readAscii(view, exifIfd.get(TAG_DATETIME_ORIGINAL) || {}))
        || toDateOnly(readAscii(view, exifIfd.get(TAG_DATETIME_DIGITIZED) || {}))
    }
    if (!date) date = toDateOnly(readAscii(view, ifd0.get(TAG_DATETIME) || {}))

    // Coordinates
    let lat = null
    let lng = null
    const gpsPtr = ifd0.get(TAG_GPS_IFD)
    if (gpsPtr) {
      const gps = readIfd(view, tiff, tiff + view.getUint32(gpsPtr.offset, le), le)
      const latRef = readAscii(view, gps.get(TAG_GPS_LAT_REF) || {})
      const lngRef = readAscii(view, gps.get(TAG_GPS_LNG_REF) || {})
      const latDms = gps.has(TAG_GPS_LAT) ? readRationals(view, gps.get(TAG_GPS_LAT), le) : null
      const lngDms = gps.has(TAG_GPS_LNG) ? readRationals(view, gps.get(TAG_GPS_LNG), le) : null

      lat = dmsToDecimal(latDms, latRef)
      lng = dmsToDecimal(lngDms, lngRef)

      const usable =
        lat != null && lng != null &&
        Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
        // Null Island is what a GPS with no fix writes, not a place anyone was.
        !(lat === 0 && lng === 0)
      if (!usable) { lat = null; lng = null }
    }

    return { date, lat, lng }
  } catch {
    return EMPTY
  }
}
