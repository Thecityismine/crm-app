import { useState, useRef } from 'react'
import { parseCSV, mapCSVRowToContact } from '@/utils/importMapper'
import { batchImportContacts } from '@/lib/firebase/contacts'
import { useSettingsStore } from '@/store/settingsStore'
import { Upload, CheckCircle, AlertCircle, FileText, Plus, X } from 'lucide-react'

function ImportSection({ title, description, onImport }) {
  const inputRef = useRef()
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('idle') // idle | previewing | importing | done | error
  const [message, setMessage] = useState('')

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
        setMessage('')
      } catch {
        setStatus('error')
        setMessage('Could not parse this file. Make sure it is a valid CSV export from Notion.')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!preview?.valid?.length) return
    setStatus('importing')
    try {
      await onImport(preview.valid)
      setStatus('done')
      setMessage(`${preview.valid.length} records imported successfully.`)
      setPreview(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setStatus('error')
      setMessage(`Import failed: ${err.message}`)
    }
  }

  const reset = () => {
    setStatus('idle')
    setPreview(null)
    setMessage('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="card p-5">
      <h3 className="font-medium text-gray-200 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>

      {status === 'idle' || status === 'error' ? (
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-700 rounded-lg p-8 cursor-pointer hover:border-gray-600 hover:bg-gray-800/30 transition-all">
          <Upload size={24} className="text-gray-600" />
          <span className="text-sm text-gray-400">Click to upload CSV file</span>
          <span className="text-xs text-gray-600">Exported from Notion</span>
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
      ) : null}

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
              <div key={i} className="text-xs text-gray-500 pl-2 border-l border-gray-800">
                {name}
              </div>
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
          <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-300">Importing records...</span>
        </div>
      )}

      {status === 'done' && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-green-400">{message}</p>
          </div>
          <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300">Import more</button>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-3 flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{message}</p>
        </div>
      )}
    </div>
  )
}

function RelationshipOptions() {
  const { relationshipOptions, addRelationshipOption, removeRelationshipOption } = useSettingsStore()
  const [newValue, setNewValue] = useState('')

  const handleAdd = () => {
    const trimmed = newValue.trim()
    if (!trimmed || relationshipOptions.includes(trimmed)) return
    addRelationshipOption(trimmed)
    setNewValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
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
          onKeyDown={handleKeyDown}
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

export default function Settings() {
  const handleImportContacts = async (rows) => {
    const contacts = rows.map(mapCSVRowToContact).filter((c) => c.firstName || c.lastName)
    await batchImportContacts(contacts)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-100 mb-1">Settings</h1>
      <p className="text-gray-500 text-sm mb-8">Manage your workspace and data.</p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Contacts
        </h2>
        <RelationshipOptions />
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Import Data
        </h2>
        <div className="space-y-4">
          <ImportSection
            title="Import Contacts"
            description='Upload the "Client Contacts" CSV exported from Notion. All fields including relationship, follow-up dates, and notes will be imported.'
            onImport={handleImportContacts}
          />
        </div>
      </section>
    </div>
  )
}
