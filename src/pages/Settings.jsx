import { useState, useRef, useEffect } from 'react'
import { auth, storage } from '@/config/firebase'
import { updateProfile } from 'firebase/auth'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { parseCSV, mapCSVRowToContact } from '@/utils/importMapper'
import { batchImportContacts, getContacts } from '@/lib/firebase/contacts'
import { getDeals } from '@/lib/firebase/deals'
import { getTasks } from '@/lib/firebase/tasks'
import { useSettingsStore, PIPELINE_TEMPLATES } from '@/store/settingsStore'
import { useContactStore } from '@/store/contactStore'
import {
  Upload, CheckCircle, AlertCircle, FileText, Plus, X,
  Download, User, Briefcase, CheckSquare, Camera,
} from 'lucide-react'

// ── CSV export helper ─────────────────────────────────────────────────────────
function downloadCSV(filename, rows, headers) {
  const esc = (v) => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{label}</h2>
      {children}
    </section>
  )
}

// ── Resize image to max side px via canvas, returns a Blob ───────────────────
function resizeImage(file, maxSide = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const w = Math.round(img.width  * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, 'image/jpeg', 0.88)
    }
    img.onerror = reject
    img.src = url
  })
}

// ── 1. User Profile ───────────────────────────────────────────────────────────
function UserProfileSection() {
  const user = auth.currentUser
  const [editing,     setEditing]     = useState(false)
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [photoURL,    setPhotoURL]    = useState(user?.photoURL    || '')
  const [saving,      setSaving]      = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [photoError,  setPhotoError]  = useState('')
  const fileInputRef = useRef()

  if (!user) return null

  const initials = (user.displayName || user.email || '?')
    .split(' ').slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() || null })
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Profile update failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError('')
    setUploading(true)
    try {
      const blob = await resizeImage(file, 400)
      const storageRef = ref(storage, `profile-photos/${user.uid}`)
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' })
      const url = await getDownloadURL(storageRef)
      await updateProfile(auth.currentUser, { photoURL: url })
      setPhotoURL(url)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Photo upload failed:', err)
      setPhotoError('Upload failed — check storage rules.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="card p-5 flex items-start gap-4">
      {/* Clickable avatar */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="relative w-14 h-14 rounded-full flex-shrink-0 group focus:outline-none"
        title="Change profile photo"
      >
        {photoURL ? (
          <img src={photoURL} alt="" className="w-14 h-14 rounded-full object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-lg select-none">
            {initials}
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Camera size={16} className="text-white" />
          }
        </div>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoChange}
      />

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <input
              autoFocus
              className="input text-sm w-full max-w-xs"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setEditing(false); setDisplayName(user?.displayName || '') }}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <p className="text-gray-200 font-medium">{user.displayName || 'No name set'}</p>
              {saved && <span className="text-xs text-green-400">Saved</span>}
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-gray-600 hover:text-blue-400 transition-colors"
              >
                Edit
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
            {photoError && <p className="text-xs text-red-400 mt-1">{photoError}</p>}
            <p className="text-xs text-gray-600 mt-1">Tap photo to change</p>
          </>
        )}
      </div>
    </div>
  )
}

// ── 2. Relationship Types ─────────────────────────────────────────────────────
function RelationshipOptions() {
  const { relationshipOptions, addRelationshipOption, removeRelationshipOption } = useSettingsStore()
  const [newValue, setNewValue] = useState('')

  const handleAdd = () => {
    const trimmed = newValue.trim()
    if (!trimmed || relationshipOptions.includes(trimmed)) return
    addRelationshipOption(trimmed)
    setNewValue('')
  }

  return (
    <div className="card p-5">
      <h3 className="font-medium text-gray-200 mb-1">Relationship Types</h3>
      <p className="text-sm text-gray-500 mb-4">
        Customize the options available in the Relationship dropdown on contact forms.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {relationshipOptions.map((option) => (
          <span
            key={option}
            className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 border border-gray-700 rounded-full text-sm text-gray-300"
          >
            {option}
            <button
              onClick={() => removeRelationshipOption(option)}
              className="text-gray-600 hover:text-red-400 transition-colors"
              aria-label={`Remove ${option}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {relationshipOptions.length === 0 && (
          <p className="text-sm text-gray-600">No options yet — add one below.</p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="e.g. Broker, Investor, Mentor..."
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
        />
        <button
          onClick={handleAdd}
          disabled={!newValue.trim()}
          className="btn-primary flex items-center gap-1.5 disabled:opacity-40"
        >
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  )
}

// ── 3. Industry Types ─────────────────────────────────────────────────────────
function IndustryOptions() {
  const { industryOptions, addIndustryOption, removeIndustryOption } = useSettingsStore()
  const [newValue, setNewValue] = useState('')

  const handleAdd = () => {
    const trimmed = newValue.trim()
    if (!trimmed || industryOptions.includes(trimmed)) return
    addIndustryOption(trimmed)
    setNewValue('')
  }

  return (
    <div className="card p-5">
      <h3 className="font-medium text-gray-200 mb-1">Industry Types</h3>
      <p className="text-sm text-gray-500 mb-4">
        Customize the options available in the Industry dropdown on company forms.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {industryOptions.map((option) => (
          <span
            key={option}
            className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 border border-gray-700 rounded-full text-sm text-gray-300"
          >
            {option}
            <button
              onClick={() => removeIndustryOption(option)}
              className="text-gray-600 hover:text-red-400 transition-colors"
              aria-label={`Remove ${option}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {industryOptions.length === 0 && (
          <p className="text-sm text-gray-600">No options yet — add one below.</p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="e.g. Private Equity, Media, Retail..."
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
        />
        <button
          onClick={handleAdd}
          disabled={!newValue.trim()}
          className="btn-primary flex items-center gap-1.5 disabled:opacity-40"
        >
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  )
}

// ── 5. Pipeline Template ──────────────────────────────────────────────────────
const TEMPLATE_OPTIONS = [
  { value: 'default',     label: 'Default',     desc: 'Lead → Qualified → Proposal → Negotiation → Won / Lost' },
  { value: 'leasing',     label: 'Leasing',     desc: 'Prospect → Showing → Application → Lease Out → Closed / Lost' },
  { value: 'acquisition', label: 'Acquisition', desc: 'Sourcing → LOI → Due Diligence → Under Contract → Closed / Dead' },
  { value: 'development', label: 'Development', desc: 'Land → Entitlement → Design → Construction → Lease-Up → Completed' },
  { value: 'lending',     label: 'Lending',     desc: 'Inquiry → Term Sheet → Processing → Underwriting → Funded / Declined' },
]

function PipelineSection() {
  const { pipelineTemplate, setPipelineTemplate } = useSettingsStore()

  return (
    <div className="card p-5">
      <h3 className="font-medium text-gray-200 mb-1">Pipeline Template</h3>
      <p className="text-sm text-gray-500 mb-4">
        Choose a preset that matches your workflow. Stages apply immediately to the Kanban board.
      </p>
      <div className="space-y-2">
        {TEMPLATE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              pipelineTemplate === opt.value
                ? 'border-blue-500/50 bg-blue-500/5'
                : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/30'
            }`}
          >
            <input
              type="radio"
              name="pipelineTemplate"
              value={opt.value}
              checked={pipelineTemplate === opt.value}
              onChange={() => setPipelineTemplate(opt.value)}
              className="mt-0.5 accent-blue-500 flex-shrink-0"
            />
            <div>
              <p className="text-sm font-medium text-gray-300">{opt.label}</p>
              <p className="text-xs text-gray-600 mt-0.5">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── 6. Import Data ────────────────────────────────────────────────────────────
function ImportSection({ onImport }) {
  const inputRef = useRef()
  const [preview,       setPreview]       = useState(null)
  const [status,        setStatus]        = useState('idle') // idle | previewing | importing | done | error
  const [importResult,  setImportResult]  = useState(null)  // { imported, skipped }
  const [errorMessage,  setErrorMessage]  = useState('')

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target.result)
        const valid = rows.filter((r) => {
          const name = r['Contact Name'] || r['Company'] || r['Name'] || ''
          return name.trim().length > 0
        })
        setPreview({ file: file.name, total: rows.length, valid })
        setStatus('previewing')
        setErrorMessage('')
      } catch {
        setStatus('error')
        setErrorMessage('Could not parse this file. Make sure it is a valid CSV export from Notion.')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!preview?.valid?.length) return
    setStatus('importing')
    try {
      const result = await onImport(preview.valid)
      setImportResult(result)
      setStatus('done')
      setPreview(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setStatus('error')
      setErrorMessage(`Import failed: ${err.message}`)
    }
  }

  const reset = () => {
    setStatus('idle')
    setPreview(null)
    setImportResult(null)
    setErrorMessage('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="card p-5">
      <h3 className="font-medium text-gray-200 mb-1">Import Contacts</h3>
      <p className="text-sm text-gray-500 mb-4">
        Upload the "Client Contacts" CSV exported from Notion. Relationship, follow-up dates, and notes will all be imported.
      </p>

      {(status === 'idle' || status === 'error') && (
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-700 rounded-lg p-8 cursor-pointer hover:border-gray-600 hover:bg-gray-800/30 transition-all">
          <Upload size={24} className="text-gray-600" />
          <span className="text-sm text-gray-400">Click to upload CSV file</span>
          <span className="text-xs text-gray-600">Exported from Notion</span>
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
      )}

      {status === 'error' && errorMessage && (
        <div className="mt-3 flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{errorMessage}</p>
        </div>
      )}

      {status === 'previewing' && preview && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
            <FileText size={18} className="text-gray-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gray-200">{preview.file}</p>
              <p className="text-xs text-gray-500">{preview.valid.length} records ready to import</p>
            </div>
          </div>
          {preview.valid.slice(0, 3).map((row, i) => {
            const name = row['Contact Name'] || row['Company'] || row['Name'] || '—'
            return (
              <div key={i} className="text-xs text-gray-500 pl-2 border-l border-gray-800">{name}</div>
            )
          })}
          {preview.valid.length > 3 && (
            <p className="text-xs text-gray-600 pl-2">...and {preview.valid.length - 3} more</p>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={handleImport} className="btn-primary">
              Import {preview.valid.length} Records
            </button>
            <button onClick={reset} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {status === 'importing' && (
        <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-300">Importing records...</span>
        </div>
      )}

      {status === 'done' && importResult && (
        <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <CheckCircle size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-400 font-medium">
              {importResult.imported} contact{importResult.imported !== 1 ? 's' : ''} imported
            </p>
            {importResult.skipped > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                {importResult.skipped} skipped — duplicates detected
              </p>
            )}
          </div>
          <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300 flex-shrink-0">
            Import more
          </button>
        </div>
      )}
    </div>
  )
}

// ── 7. Export Data ────────────────────────────────────────────────────────────
function ExportSection({ contacts }) {
  const [exporting, setExporting] = useState(null)

  const handleExport = async (type) => {
    setExporting(type)
    try {
      if (type === 'contacts') {
        downloadCSV('contacts.csv', contacts, [
          'firstName', 'lastName', 'company', 'title', 'email',
          'mobilePhone', 'relationship', 'location', 'linkedin',
          'nextFollowUp', 'lastCommunication', 'interval',
        ])
      } else if (type === 'deals') {
        const deals = await getDeals()
        downloadCSV('deals.csv', deals, [
          'title', 'stage', 'value', 'contactName', 'closingDate', 'description',
        ])
      } else if (type === 'tasks') {
        const tasks = await getTasks()
        downloadCSV('tasks.csv', tasks, [
          'title', 'status', 'priority', 'dueDate', 'contactName', 'dealTitle', 'description',
        ])
      }
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(null)
    }
  }

  const items = [
    { type: 'contacts', label: 'Contacts', count: contacts.length, Icon: User },
    { type: 'deals',    label: 'Deals',    count: null,            Icon: Briefcase },
    { type: 'tasks',    label: 'Tasks',    count: null,            Icon: CheckSquare },
  ]

  return (
    <div className="card p-5">
      <h3 className="font-medium text-gray-200 mb-1">Export Data</h3>
      <p className="text-sm text-gray-500 mb-4">Download your data as CSV files.</p>
      <div className="space-y-2">
        {items.map(({ type, label, count, Icon }) => (
          <div
            key={type}
            className="flex items-center justify-between p-3 rounded-lg bg-gray-800/40 border border-gray-800"
          >
            <div className="flex items-center gap-2.5">
              <Icon size={15} className="text-gray-500" />
              <span className="text-sm text-gray-300">{label}</span>
              {count != null && <span className="text-xs text-gray-600">({count})</span>}
            </div>
            <button
              onClick={() => handleExport(type)}
              disabled={exporting === type}
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
            >
              <Download size={13} />
              {exporting === type ? 'Exporting...' : 'Download CSV'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 8. Notification Preferences ───────────────────────────────────────────────
function NotificationsSection() {
  const { notificationPrefs, setNotificationPref } = useSettingsStore()

  const prefs = [
    {
      key:  'followUpReminders',
      label: 'Follow-up reminders',
      desc:  'Alert when a contact is overdue for a follow-up',
    },
    {
      key:  'dealAlerts',
      label: 'Deal alerts',
      desc:  'Alert when a deal has stalled or is past its closing date',
    },
    {
      key:  'weeklyDigest',
      label: 'Weekly digest',
      desc:  'Summary of activity and upcoming follow-ups every Monday',
    },
  ]

  return (
    <div className="card p-5">
      <h3 className="font-medium text-gray-200 mb-1">Notification Preferences</h3>
      <p className="text-sm text-gray-500 mb-4">
        Your preferences are saved — notification delivery is coming soon.
      </p>
      <div className="divide-y divide-gray-800">
        {prefs.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm text-gray-300">{label}</p>
              <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
            </div>
            <button
              onClick={() => setNotificationPref(key, !notificationPrefs[key])}
              role="switch"
              aria-checked={notificationPrefs[key]}
              className={`relative flex-shrink-0 ml-4 w-10 h-5 rounded-full transition-colors ${
                notificationPrefs[key] ? 'bg-blue-500' : 'bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  notificationPrefs[key] ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Settings() {
  const { contacts, setContacts } = useContactStore()
  const { syncFromFirestore } = useSettingsStore()

  // Sync Firestore settings once on mount
  useEffect(() => { syncFromFirestore() }, [])

  const handleImportContacts = async (rows) => {
    const mapped = rows.map(mapCSVRowToContact).filter((c) => c.firstName || c.lastName)

    const emailSet = new Set(contacts.map((c) => c.email?.toLowerCase()).filter(Boolean))
    const nameSet  = new Set(
      contacts.map((c) => `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().trim()).filter(Boolean)
    )

    const toImport = []
    let skipped    = 0

    for (const c of mapped) {
      const email = c.email?.toLowerCase()
      const name  = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().trim()
      if ((email && emailSet.has(email)) || (name && nameSet.has(name))) {
        skipped++
      } else {
        toImport.push(c)
      }
    }

    if (toImport.length > 0) {
      await batchImportContacts(toImport)
      // Refresh the contact store in the background
      getContacts().then(setContacts).catch(console.warn)
    }

    return { imported: toImport.length, skipped }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-100 mb-1">Settings</h1>
      <p className="text-gray-500 text-sm mb-8">Manage your workspace and data.</p>

      <Section label="User Profile">
        <UserProfileSection />
      </Section>

      <Section label="Contacts">
        <RelationshipOptions />
      </Section>

      <Section label="Companies">
        <IndustryOptions />
      </Section>

      <Section label="Pipeline">
        <PipelineSection />
      </Section>

      <Section label="Import Data">
        <ImportSection onImport={handleImportContacts} />
      </Section>

      <Section label="Export Data">
        <ExportSection contacts={contacts} />
      </Section>

      <Section label="Notifications">
        <NotificationsSection />
      </Section>
    </div>
  )
}
