// Maps Notion export CSV or API response to CRM schema
// Used during Notion import flow

export const mapCSVRowToContact = (row) => ({
  firstName: row['First Name'] || row['Name']?.split(' ')[0] || '',
  lastName: row['Last Name'] || row['Name']?.split(' ').slice(1).join(' ') || '',
  email: row['Email'] ? [row['Email']] : [],
  phone: row['Phone'] ? [row['Phone']] : [],
  contactType: (row['Type'] || 'other').toLowerCase(),
  tags: row['Tags'] ? row['Tags'].split(',').map((t) => t.trim()) : [],
  notes: row['Notes'] || '',
  source: 'import',
})

export const mapCSVRowToCompany = (row) => ({
  name: row['Company'] || row['Name'] || '',
  industry: row['Industry'] || '',
  website: row['Website'] || '',
  notes: row['Notes'] || '',
  source: 'import',
})

export const mapCSVRowToDeal = (row) => ({
  name: row['Deal Name'] || row['Name'] || '',
  value: parseFloat(row['Value']?.replace(/[$,]/g, '') || '0'),
  dealType: (row['Type'] || 'other').toLowerCase(),
  notes: row['Notes'] || '',
  source: 'import',
})
