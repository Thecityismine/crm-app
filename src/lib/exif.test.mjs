// Builds minimal JPEGs carrying known EXIF, then checks the parser reads them
// back. Covers both TIFF byte orders, since the order is declared in the file
// and a parser that assumes little-endian passes half the time.
import { readPhotoMeta } from './exif.js'

// --- offsets within the TIFF block ---
const IFD0 = 8
const EXIF_IFD = 38
const GPS_IFD = 56
const DATA = 110
const OFF_DATE = DATA
const OFF_LAT = DATA + 20
const OFF_LNG = DATA + 44
const TIFF_LEN = DATA + 68

function buildTiff({ le, date, lat, lng, withGps = true, withDate = true }) {
  const b = new Uint8Array(TIFF_LEN)
  const v = new DataView(b.buffer)
  const u16 = (o, n) => v.setUint16(o, n, le)
  const u32 = (o, n) => v.setUint32(o, n, le)

  // TIFF header
  v.setUint16(0, le ? 0x4949 : 0x4d4d)   // byte order is itself order-independent
  u16(2, 0x002a)
  u32(4, IFD0)

  const entry = (at, tag, type, count, valueWriter) => {
    u16(at, tag); u16(at + 2, type); u32(at + 4, count); valueWriter(at + 8)
  }

  // IFD0: pointers to the Exif and GPS sub-IFDs
  const ifd0Entries = []
  if (withDate) ifd0Entries.push([0x8769, 4, 1, (o) => u32(o, EXIF_IFD)])
  if (withGps) ifd0Entries.push([0x8825, 4, 1, (o) => u32(o, GPS_IFD)])
  u16(IFD0, ifd0Entries.length)
  ifd0Entries.forEach(([t, ty, c, w], i) => entry(IFD0 + 2 + i * 12, t, ty, c, w))
  u32(IFD0 + 2 + ifd0Entries.length * 12, 0)

  // Exif IFD: DateTimeOriginal
  if (withDate) {
    u16(EXIF_IFD, 1)
    entry(EXIF_IFD + 2, 0x9003, 2, 20, (o) => u32(o, OFF_DATE))
    u32(EXIF_IFD + 14, 0)
    const s = date + '\0'
    for (let i = 0; i < s.length; i++) b[OFF_DATE + i] = s.charCodeAt(i)
  }

  // GPS IFD: refs inline (2 bytes fits the 4-byte slot), coordinates by offset
  if (withGps) {
    u16(GPS_IFD, 4)
    entry(GPS_IFD + 2, 0x0001, 2, 2, (o) => { b[o] = lat.ref.charCodeAt(0); b[o + 1] = 0 })
    entry(GPS_IFD + 14, 0x0002, 5, 3, (o) => u32(o, OFF_LAT))
    entry(GPS_IFD + 26, 0x0003, 2, 2, (o) => { b[o] = lng.ref.charCodeAt(0); b[o + 1] = 0 })
    entry(GPS_IFD + 38, 0x0004, 5, 3, (o) => u32(o, OFF_LNG))
    u32(GPS_IFD + 50, 0)
    lat.dms.forEach(([n, d], i) => { u32(OFF_LAT + i * 8, n); u32(OFF_LAT + i * 8 + 4, d) })
    lng.dms.forEach(([n, d], i) => { u32(OFF_LNG + i * 8, n); u32(OFF_LNG + i * 8 + 4, d) })
  }
  return b
}

function buildJpeg(tiff, { extraSegment = false } = {}) {
  const parts = [new Uint8Array([0xff, 0xd8])]
  if (extraSegment) {
    // An APP0/JFIF block ahead of APP1, which is what real cameras emit.
    const jfif = new Uint8Array(18)
    jfif[0] = 0xff; jfif[1] = 0xe0
    jfif[2] = 0x00; jfif[3] = 16
    'JFIF\0'.split('').forEach((c, i) => { jfif[4 + i] = c.charCodeAt(0) })
    parts.push(jfif)
  }
  if (tiff) {
    const payload = 6 + tiff.length
    const head = new Uint8Array(4 + 6)
    head[0] = 0xff; head[1] = 0xe1
    head[2] = (payload + 2) >> 8; head[3] = (payload + 2) & 0xff
    'Exif'.split('').forEach((c, i) => { head[4 + i] = c.charCodeAt(0) })
    head[8] = 0; head[9] = 0
    parts.push(head, tiff)
  }
  parts.push(new Uint8Array([0xff, 0xda, 0x00, 0x02]))  // SOS
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}

// Minimal File stand-in: the parser only uses slice().arrayBuffer().
const asFile = (bytes) => ({
  slice: () => ({ arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) }),
})

const MIAMI = {
  lat: { ref: 'N', dms: [[25, 1], [45, 1], [4212, 100]] },   // 25.7617
  lng: { ref: 'W', dms: [[80, 1], [11, 1], [3048, 100]] },   // -80.1918
}

let failures = 0
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failures++
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + '  ->  ' + JSON.stringify(got) +
    (ok ? '' : '   expected ' + JSON.stringify(want)))
}

const round = (r) => ({ date: r.date, lat: r.lat == null ? null : +r.lat.toFixed(4), lng: r.lng == null ? null : +r.lng.toFixed(4) })

for (const le of [true, false]) {
  const label = le ? 'little-endian (II)' : 'big-endian (MM)'
  const jpeg = buildJpeg(buildTiff({ le, date: '2026:08:17 09:30:00', ...MIAMI }))
  check(label, round(await readPhotoMeta(asFile(jpeg))),
    { date: '2026-08-17', lat: 25.7617, lng: -80.1918 })
}

// A JFIF segment before APP1 — the parser has to walk the chain, not assume.
check('APP0 before APP1',
  round(await readPhotoMeta(asFile(buildJpeg(buildTiff({ le: true, date: '2026:08:17 09:30:00', ...MIAMI }), { extraSegment: true })))),
  { date: '2026-08-17', lat: 25.7617, lng: -80.1918 })

// Southern / eastern hemisphere must come back negative / positive correctly.
check('S/E hemisphere signs',
  round(await readPhotoMeta(asFile(buildJpeg(buildTiff({
    le: true, date: '2026:01:02 00:00:00',
    lat: { ref: 'S', dms: [[33, 1], [51, 1], [3564, 100]] },
    lng: { ref: 'E', dms: [[151, 1], [12, 1], [4000, 100]] },
  }))))),
  { date: '2026-01-02', lat: -33.8599, lng: 151.2111 })

check('date only, no GPS',
  round(await readPhotoMeta(asFile(buildJpeg(buildTiff({ le: true, date: '2026:03:04 12:00:00', ...MIAMI, withGps: false }))))),
  { date: '2026-03-04', lat: null, lng: null })

check('GPS only, no date',
  round(await readPhotoMeta(asFile(buildJpeg(buildTiff({ le: true, date: '', ...MIAMI, withDate: false }))))),
  { date: null, lat: 25.7617, lng: -80.1918 })

check('null island rejected',
  round(await readPhotoMeta(asFile(buildJpeg(buildTiff({
    le: true, date: '2026:03:04 12:00:00',
    lat: { ref: 'N', dms: [[0, 1], [0, 1], [0, 1]] },
    lng: { ref: 'E', dms: [[0, 1], [0, 1], [0, 1]] },
  }))))),
  { date: '2026-03-04', lat: null, lng: null })

check('dead camera clock rejected',
  round(await readPhotoMeta(asFile(buildJpeg(buildTiff({ le: true, date: '0000:00:00 00:00:00', ...MIAMI }))))),
  { date: null, lat: 25.7617, lng: -80.1918 })

check('JPEG with no EXIF', round(await readPhotoMeta(asFile(buildJpeg(null)))), { date: null, lat: null, lng: null })
check('not an image at all', round(await readPhotoMeta(asFile(new Uint8Array([1, 2, 3, 4, 5])))), { date: null, lat: null, lng: null })
check('empty file', round(await readPhotoMeta(asFile(new Uint8Array(0)))), { date: null, lat: null, lng: null })
check('truncated mid-EXIF',
  round(await readPhotoMeta(asFile(buildJpeg(buildTiff({ le: true, date: '2026:08:17 09:30:00', ...MIAMI })).slice(0, 40)))),
  { date: null, lat: null, lng: null })

console.log(failures === 0 ? '\nall passed' : '\n' + failures + ' FAILED')
process.exit(failures ? 1 : 0)
