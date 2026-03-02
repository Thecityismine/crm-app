// Strip Notion inline link: "Name (https://notion.so/...)" → "Name"
const stripNotionUrl = (str) =>
  str ? str.replace(/\s*\(https?:\/\/[^)]+\)/g, '').trim() : ''

// Month abbreviation → zero-padded number
const MONTH_MAP = {
  jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
  jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
}

// Parse dates in these formats → YYYY-MM-DD
//   "16-Sep-89"  "3-Feb-18"  "19-May-24"   (Notion short export)
//   "March 28, 2025 12:53 PM"              (Notion long datetime)
//   "2025-03-28"                           (already ISO)
export const parseDateOnly = (str) => {
  if (!str || str.trim() === '' || str === '—') return ''
  str = str.trim().replace(/\s+/g, ' ')

  // D-Mon-YY or DD-Mon-YY  e.g. "16-Sep-89", "3-Feb-18"
  const shortMatch = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/)
  if (shortMatch) {
    const day   = shortMatch[1].padStart(2, '0')
    const mon   = MONTH_MAP[shortMatch[2].toLowerCase()]
    if (!mon) return ''
    const yy    = parseInt(shortMatch[3], 10)
    const year  = yy < 30 ? 2000 + yy : 1900 + yy  // 89→1989, 24→2024
    return `${year}-${mon}-${day}`
  }

  // D-Mon-YYYY  e.g. "16-Sep-1989"
  const longMatch = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (longMatch) {
    const day  = longMatch[1].padStart(2, '0')
    const mon  = MONTH_MAP[longMatch[2].toLowerCase()]
    if (!mon) return ''
    return `${longMatch[3]}-${mon}-${day}`
  }

  // Fallback: native Date (works for ISO and most English formats)
  const d = new Date(str)
  if (isNaN(d.getTime())) return ''
  // Parse as local date to avoid UTC-shift for date-only strings
  const iso = d.toISOString().slice(0, 10)
  return iso
}

// Parse Notion datetime string → ISO timestamp or null
const parseDateTime = (str) => {
  if (!str || str === '—' || str.includes('🛑')) return null
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// Clean an email field — return empty string if it doesn't contain '@'
const cleanEmail = (str) => {
  const s = (str || '').trim()
  return s.includes('@') ? s : ''
}

// Clean an address field — discard map URLs, mailto: entries, bare URLs
const cleanAddress = (str) => {
  const s = (str || '').trim()
  if (!s) return ''
  if (s.startsWith('http') || s.startsWith('mailto:')) return ''
  if (s.includes('maps.apple.com') || s.includes('maps.google.com')) return ''
  // Strip mailto: fragment if embedded mid-string
  return s.replace(/,?\s*mailto:[^\s,]*/g, '').trim()
}

// Clean a name — collapse whitespace/newlines → single spaces
const cleanName = (str) =>
  (str || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()

// ── CSV parser ── (character-by-character to handle multi-line quoted fields)
export const parseCSV = (text) => {
  const src  = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows = []
  let row    = []
  let field  = ''
  let quoted = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (ch === '"') {
      if (quoted && src[i + 1] === '"') { field += '"'; i++ }  // escaped quote
      else { quoted = !quoted }
    } else if (ch === ',' && !quoted) {
      row.push(field.trim()); field = ''
    } else if (ch === '\n' && !quoted) {
      row.push(field.trim()); field = ''
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  // trailing field / row
  row.push(field.trim())
  if (row.some((f) => f !== '')) rows.push(row)

  if (rows.length < 2) return []

  // Strip BOM from first header
  const headers = rows[0].map((h, i) => (i === 0 ? h.replace(/^\uFEFF/, '') : h))

  return rows.slice(1).map((values) =>
    headers.reduce((obj, h, i) => {
      obj[h.trim()] = (values[i] ?? '').trim()
      return obj
    }, {})
  )
}

// Map Notion "Client Contacts" CSV export row → CRM contact schema
export const mapCSVRowToContact = (row) => {
  const fullName  = cleanName(row['Contact Name'] || '')
  const nameParts = fullName.split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName  = nameParts.slice(1).join(' ')

  // Relationship: take the first value if comma-separated
  const rawRel     = (row['Relationship'] || '').trim()
  const relationship = rawRel.split(',')[0].trim()

  // Wedding Anniversary column has a trailing space in the Notion export
  const weddingRaw = row['Wedding Anniversary'] || row['Wedding Anniversary '] || ''

  return {
    firstName,
    lastName,
    fullName,
    company:           stripNotionUrl(row['Company'] || ''),
    title:             (row['Title'] || '').trim(),
    relationship,
    stage:             (row['Stage'] || '').trim(),
    status:            (row['Status'] || '').trim(),
    email:             cleanEmail(row['Email'] || ''),
    mobilePhone:       (row['Mobile Phone'] || '').trim(),
    officePhone:       (row['Office Phone'] || '').trim(),
    location:          (row['Location'] || '').trim(),
    address:           cleanAddress(row['Address'] || ''),
    interval:          (row['Interval'] || '').trim(),
    linkedin:          (row['Linkedin'] || '').trim(),
    instagram:         (row['Instagram'] || row['Instagram Profile'] || '').trim(),
    website:           (row['Web Site'] || '').trim(),
    university:        (row['University'] || '').trim(),
    clientNotes:       (row['Client Notes'] || '').trim(),
    birthdate:         parseDateOnly(row['Birthdate']),
    weddingAnniversary: parseDateOnly(weddingRaw),
    nextBirthday:      parseDateOnly(row['Next Birthday']),
    nextFollowUp:      parseDateTime(row['Next Follow Up']),
    lastCommunication: parseDateTime(row['Last Communication']),
    source:            'notion_import',
  }
}

// Map Notion "Accounts Companies" CSV export row → CRM company schema
export const mapCSVRowToCompany = (row) => ({
  name:         stripNotionUrl(row['Company'] || row['Name'] || ''),
  relationship: (row['Relationship'] || '').trim(),
  website:      (row['Website'] || '').trim(),
  source:       'notion_import',
})
