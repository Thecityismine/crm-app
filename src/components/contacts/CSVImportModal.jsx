import { useState, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import { createContact } from '@/lib/firebase/contacts'
import { parseDateOnly } from '@/utils/importMapper'
import { Upload, FileText, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react'

// ── Contact fields available for mapping ───────────────────────────────────
const CONTACT_FIELDS = [
  { value: '',             label: '— Skip —' },
  { value: 'fullName',    label: 'Full Name (auto-split)' },
  { value: 'firstName',   label: 'First Name' },
  { value: 'lastName',    label: 'Last Name' },
  { value: 'email',       label: 'Email' },
  { value: 'mobilePhone', label: 'Mobile Phone' },
  { value: 'officePhone', label: 'Office Phone' },
  { value: 'company',     label: 'Company' },
  { value: 'title',       label: 'Job Title' },
  { value: 'location',    label: 'Location' },
  { value: 'address',     label: 'Address' },
  { value: 'linkedin',    label: 'LinkedIn' },
  { value: 'instagram',   label: 'Instagram' },
  { value: 'website',     label: 'Website' },
  { value: 'relationship',label: 'Relationship' },
  { value: 'birthdate',          label: 'Birthday' },
  { value: 'weddingAnniversary', label: 'Wedding Anniversary' },
  { value: 'university',         label: 'University' },
  { value: 'clientNotes', label: 'Notes' },
  { value: 'nextFollowUp',label: 'Next Follow Up' },
]

// Auto-detect common CSV header names → contact fields
const AUTO_MAP = {
  // Full name (Notion exports a single "Contact Name" column)
  'contact name': 'fullName', 'name': 'fullName', 'full name': 'fullName', 'fullname': 'fullName',
  // Split name
  'first name': 'firstName', 'firstname': 'firstName', 'first_name': 'firstName', 'given name': 'firstName',
  'last name': 'lastName',  'lastname': 'lastName',  'last_name': 'lastName',  'surname': 'lastName', 'family name': 'lastName',
  // Contact info
  'email': 'email', 'email address': 'email', 'e-mail': 'email', 'e mail': 'email',
  'phone': 'mobilePhone', 'mobile': 'mobilePhone', 'cell': 'mobilePhone',
  'mobile phone': 'mobilePhone', 'cell phone': 'mobilePhone', 'phone number': 'mobilePhone',
  'office phone': 'officePhone', 'work phone': 'officePhone', 'direct': 'officePhone',
  'company': 'company', 'organization': 'company', 'employer': 'company', 'org': 'company',
  'title': 'title', 'job title': 'title', 'position': 'title', 'role': 'title',
  'location': 'location', 'city': 'location', 'city/state': 'location', 'city, state': 'location',
  'address': 'address', 'street address': 'address',
  'linkedin': 'linkedin', 'linkedin url': 'linkedin', 'linkedin profile': 'linkedin',
  'instagram': 'instagram', 'instagram url': 'instagram', 'instagram profile': 'instagram', 'instagram handle': 'instagram',
  'website': 'website', 'web site': 'website', 'url': 'website', 'web': 'website', 'homepage': 'website',
  'relationship': 'relationship', 'type': 'relationship', 'contact type': 'relationship',
  'birthday': 'birthdate', 'birth date': 'birthdate', 'birthdate': 'birthdate', 'dob': 'birthdate', 'date of birth': 'birthdate',
  'wedding anniversary': 'weddingAnniversary', 'anniversary': 'weddingAnniversary', 'wedding date': 'weddingAnniversary',
  'university': 'university', 'school': 'university', 'education': 'university', 'college': 'university',
  'notes': 'clientNotes', 'client notes': 'clientNotes', 'comments': 'clientNotes', 'description': 'clientNotes',
  'next follow up': 'nextFollowUp', 'follow up': 'nextFollowUp', 'follow-up': 'nextFollowUp', 'follow up date': 'nextFollowUp',
}

// ── CSV parser — character-by-character to handle multi-line quoted fields ──
function parseCSV(text) {
  const src  = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows = []
  let row    = []
  let field  = ''
  let quoted = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (ch === '"') {
      if (quoted && src[i + 1] === '"') { field += '"'; i++ }
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

  if (rows.length < 2) return { headers: [], rows: [] }

  // Strip BOM from first header
  const headers = rows[0].map((h, i) => (i === 0 ? h.replace(/^\uFEFF/, '') : h))
  return { headers, rows: rows.slice(1) }
}

function autoDetect(headers) {
  return headers.map((h) => AUTO_MAP[h.toLowerCase().trim()] || '')
}

function buildContact(row, headers, mapping) {
  const contact = {}
  headers.forEach((_, i) => {
    const field = mapping[i]
    if (!field) return
    const value = (row[i] || '').trim()
    if (!value) return
    contact[field] = value
  })
  // Parse date fields → YYYY-MM-DD (handles "3-Feb-18", ISO, etc.)
  const DATE_FIELDS = ['birthdate', 'weddingAnniversary']
  DATE_FIELDS.forEach((f) => {
    if (contact[f]) contact[f] = parseDateOnly(contact[f]) || ''
  })

  // Split fullName → firstName + lastName
  if (contact.fullName) {
    const parts = contact.fullName.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/)
    if (!contact.firstName) contact.firstName = parts[0] || ''
    if (!contact.lastName)  contact.lastName  = parts.slice(1).join(' ')
    delete contact.fullName
  }
  // Normalize email → emails array for multi-email support
  if (contact.email) {
    contact.emails = [contact.email]
  }
  return contact
}

// ── Component ──────────────────────────────────────────────────────────────
export default function CSVImportModal({ onClose, onImported }) {
  const fileRef = useRef(null)
  const [step, setStep] = useState('upload') // upload | map | importing | done
  const [dragOver, setDragOver] = useState(false)
  const [parsed, setParsed] = useState(null)   // { headers, rows }
  const [mapping, setMapping] = useState([])   // index → field name
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [importedCount, setImportedCount] = useState(0)
  const [error, setError] = useState('')

  const handleFile = (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please select a .csv file.')
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = parseCSV(e.target.result)
      if (result.headers.length === 0) {
        setError('The file appears to be empty or invalid.')
        return
      }
      setParsed(result)
      setMapping(autoDetect(result.headers))
      setStep('map')
    }
    reader.readAsText(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const canImport = () => {
    // Need at least firstName, lastName, or fullName mapped
    return mapping.some((f) => f === 'firstName' || f === 'lastName' || f === 'fullName')
  }

  const handleImport = async () => {
    const contacts = parsed.rows
      .map((row) => buildContact(row, parsed.headers, mapping))
      .filter((c) => c.firstName || c.lastName)  // skip blank rows

    if (contacts.length === 0) {
      setError('No valid contacts found. Make sure First Name or Last Name is mapped.')
      return
    }

    setStep('importing')
    setProgress({ done: 0, total: contacts.length })

    // Import in chunks of 10, updating progress after each chunk
    const CHUNK = 10
    let done = 0
    for (let i = 0; i < contacts.length; i += CHUNK) {
      const chunk = contacts.slice(i, i + CHUNK)
      await Promise.all(chunk.map((c) => createContact(c)))
      done += chunk.length
      setProgress({ done, total: contacts.length })
    }

    setImportedCount(contacts.length)
    setStep('done')
    onImported?.()
  }

  // ── Upload step ────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <Modal title="Import Contacts from CSV" onClose={onClose}>
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Upload a CSV file exported from another CRM, Google Contacts, LinkedIn, or any spreadsheet.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <Upload size={28} className="mx-auto text-gray-600 mb-3" />
            <p className="text-sm text-gray-300 font-medium">Drop your CSV here</p>
            <p className="text-xs text-gray-600 mt-1">or click to browse</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="text-xs text-gray-600 space-y-1">
            <p className="font-medium text-gray-500">Supported columns (auto-detected):</p>
            <p>First Name, Last Name, Email, Mobile Phone, Company, Job Title, Location, LinkedIn, Relationship, Notes, Birthday, and more.</p>
          </div>
        </div>
      </Modal>
    )
  }

  // ── Map step ───────────────────────────────────────────────────────────
  if (step === 'map') {
    const preview = parsed.rows.slice(0, 3)
    return (
      <Modal title={`Map Columns — ${parsed.rows.length} row${parsed.rows.length !== 1 ? 's' : ''} detected`} onClose={onClose}>
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Match each CSV column to a contact field. Columns set to <em>Skip</em> will be ignored.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left pb-2 pr-3 text-gray-500 font-medium w-1/3">CSV Column</th>
                  <th className="text-left pb-2 pr-3 text-gray-500 font-medium w-1/3">Maps To</th>
                  <th className="text-left pb-2 text-gray-500 font-medium">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {parsed.headers.map((header, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <FileText size={11} className="text-gray-600 flex-shrink-0" />
                        <span className="text-gray-300 truncate max-w-[100px]">{header}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={mapping[i] || ''}
                        onChange={(e) => {
                          const m = [...mapping]
                          m[i] = e.target.value
                          setMapping(m)
                        }}
                        className="input text-xs py-1 px-2 w-full"
                      >
                        {CONTACT_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 text-gray-500 truncate max-w-[120px]">
                      {preview.map((row) => row[i]).filter(Boolean).slice(0, 2).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {!canImport() && (
            <p className="text-xs text-amber-500">
              Map at least <strong>First Name</strong> or <strong>Last Name</strong> to continue.
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <button onClick={() => setStep('upload')} className="btn-secondary text-sm">
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={!canImport()}
              className="btn-primary flex items-center gap-1.5 disabled:opacity-40"
            >
              Import {parsed.rows.length} contacts <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── Importing step ─────────────────────────────────────────────────────
  if (step === 'importing') {
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
    return (
      <Modal title="Importing Contacts…" onClose={() => {}}>
        <div className="space-y-5 py-2">
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-brand-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-center text-sm text-gray-400">
            {progress.done} of {progress.total} contacts imported…
          </p>
        </div>
      </Modal>
    )
  }

  // ── Done step ──────────────────────────────────────────────────────────
  return (
    <Modal title="Import Complete" onClose={onClose}>
      <div className="flex flex-col items-center py-4 space-y-4 text-center">
        <CheckCircle size={40} className="text-green-500" />
        <div>
          <p className="text-lg font-semibold text-gray-100">
            {importedCount} contact{importedCount !== 1 ? 's' : ''} imported
          </p>
          <p className="text-sm text-gray-500 mt-1">Your contacts list has been updated.</p>
        </div>
        <button onClick={onClose} className="btn-primary">Done</button>
      </div>
    </Modal>
  )
}
