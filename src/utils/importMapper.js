// Strip Notion inline link: "Name (https://notion.so/...)" → "Name"
const stripNotionUrl = (str) =>
  str ? str.replace(/\s*\(https?:\/\/[^)]+\)/g, '').trim() : ''

// Parse Notion date string "March 28, 2025 12:53 PM" → ISO string or null
const parseNotionDate = (str) => {
  if (!str || str === '—' || str.includes('🛑')) return null
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// Parse Notion date to YYYY-MM-DD (for birthdate / next birthday)
const parseNotionDateOnly = (str) => {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

// Robust CSV parser: handles quoted fields, commas inside quotes, escaped quotes
export const parseCSV = (text) => {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  if (lines.length < 2) return []

  const parseRow = (line) => {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else { inQuotes = !inQuotes }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  // Strip BOM from first line
  const headers = parseRow(lines[0].replace(/^\uFEFF/, ''))

  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const values = parseRow(line)
      return headers.reduce((obj, h, i) => {
        obj[h] = values[i] || ''
        return obj
      }, {})
    })
}

// Map Notion "Client Contacts" CSV export row to CRM contact schema
export const mapCSVRowToContact = (row) => {
  const fullName = (row['Contact Name'] || '').trim()
  const nameParts = fullName.split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ')

  return {
    firstName,
    lastName,
    fullName,
    company: stripNotionUrl(row['Company'] || ''),
    title: (row['Title'] || '').trim(),
    relationship: (row['Relationship'] || '').trim(),
    stage: (row['Stage'] || '').trim(),
    status: (row['Status'] || '').trim(),
    email: (row['Email'] || '').trim(),
    mobilePhone: (row['Mobile Phone'] || '').trim(),
    officePhone: (row['Office Phone'] || '').trim(),
    location: (row['Location'] || '').trim(),
    address: (row['Address'] || '').trim(),
    interval: (row['Interval'] || '').trim(),
    linkedin: (row['Linkedin'] || '').trim(),
    website: (row['Web Site'] || '').trim(),
    university: (row['University'] || '').trim(),
    clientNotes: (row['Client Notes'] || '').trim(),
    birthdate: parseNotionDateOnly(row['Birthdate']),
    nextBirthday: parseNotionDateOnly(row['Next Birthday']),
    nextFollowUp: parseNotionDate(row['Next Follow Up']),
    lastCommunication: parseNotionDate(row['Last Communication']),
    source: 'notion_import',
  }
}

// Map Notion "Accounts Companies" CSV export row to CRM company schema
export const mapCSVRowToCompany = (row) => ({
  name: stripNotionUrl(row['Company'] || row['Name'] || ''),
  relationship: (row['Relationship'] || '').trim(),
  website: (row['Website'] || '').trim(),
  source: 'notion_import',
})
