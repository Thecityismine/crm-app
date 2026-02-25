import { useState, useRef, useCallback } from 'react'
import Modal from '@/components/ui/Modal'
import { ScanLine, Upload, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'

// Compress image client-side to stay well under Vercel's 4.5MB body limit
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1600
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve({
            base64: e.target.result.split(',')[1],
            mediaType: 'image/jpeg',
            previewUrl: canvas.toDataURL('image/jpeg', 0.7),
          })
          reader.onerror = reject
          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        0.85
      )
    }
    img.onerror = reject
    img.src = url
  })
}

const FIELD_LABELS = {
  firstName: 'First Name', lastName: 'Last Name', email: 'Email',
  mobilePhone: 'Mobile', officePhone: 'Office Phone', company: 'Company',
  title: 'Title', linkedin: 'LinkedIn', website: 'Website',
  address: 'Address', location: 'Location', university: 'University',
}

function ExtractedField({ label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-200 break-all">{value}</span>
    </div>
  )
}

export default function ScanContactModal({ onClose, onExtracted }) {
  const [phase, setPhase] = useState('upload') // upload | extracting | done | error
  const [preview, setPreview] = useState(null)   // { previewUrl, base64, mediaType }
  const [extracted, setExtracted] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setErrorMsg('Please upload an image file (PNG, JPG, WebP, etc.)')
      setPhase('error')
      return
    }
    try {
      const compressed = await compressImage(file)
      setPreview(compressed)
    } catch {
      setErrorMsg('Could not read this image. Please try another file.')
      setPhase('error')
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }, [handleFile])

  const handleExtract = async () => {
    if (!preview) return
    setPhase('extracting')
    setErrorMsg('')
    try {
      const res = await fetch('/api/extract-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: preview.base64, mediaType: preview.mediaType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`)
      setExtracted(data)
      setPhase('done')
    } catch (err) {
      setErrorMsg(err.message ?? 'Extraction failed. Please try again.')
      setPhase('error')
    }
  }

  const reset = () => {
    setPhase('upload')
    setPreview(null)
    setExtracted(null)
    setErrorMsg('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleUseContact = () => {
    onExtracted(extracted)
    onClose()
  }

  const filledCount = extracted
    ? Object.values(extracted).filter((v) => v && v.trim()).length
    : 0

  return (
    <Modal title="Scan Contact" onClose={onClose} size="lg">
      <div className="space-y-4">

        {/* Upload zone — always visible, dimmed while extracting/done */}
        {(phase === 'upload' || phase === 'error') && !preview && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-10 cursor-pointer transition-all ${
              dragging
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/30'
            }`}
          >
            <ScanLine size={32} className="text-gray-500" />
            <div className="text-center">
              <p className="text-sm text-gray-300 font-medium">Drop an image here or click to upload</p>
              <p className="text-xs text-gray-600 mt-1">Email signature · Business card · LinkedIn screenshot</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        )}

        {/* Image preview + extract button */}
        {preview && phase !== 'done' && (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-gray-800 border border-gray-700">
              <img
                src={preview.previewUrl}
                alt="Uploaded"
                className="w-full max-h-64 object-contain"
              />
              {phase === 'extracting' && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                  <Loader2 size={28} className="text-brand-500 animate-spin" />
                  <p className="text-sm text-gray-300">Reading contact info...</p>
                </div>
              )}
            </div>

            {phase !== 'extracting' && (
              <div className="flex gap-2">
                <button onClick={handleExtract} className="btn-primary flex items-center gap-2 flex-1 justify-center">
                  <ScanLine size={15} /> Extract Contact Info
                </button>
                <button onClick={reset} className="btn-secondary">
                  <Upload size={15} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {phase === 'error' && errorMsg && (
          <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-400">{errorMsg}</p>
            </div>
            <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {/* Extracted results */}
        {phase === 'done' && extracted && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <p className="text-sm text-green-400 font-medium">
                Found {filledCount} field{filledCount !== 1 ? 's' : ''}
              </p>
              <button onClick={reset} className="ml-auto text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                <RefreshCw size={12} /> Scan another
              </button>
            </div>

            {/* Side by side: image + extracted fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
                <img
                  src={preview.previewUrl}
                  alt="Scanned"
                  className="w-full h-full object-contain max-h-52"
                />
              </div>
              <div className="overflow-y-auto max-h-52">
                {Object.entries(FIELD_LABELS).map(([key, label]) => (
                  <ExtractedField key={key} label={label} value={extracted[key]} />
                ))}
                {filledCount === 0 && (
                  <p className="text-sm text-gray-500 py-2">
                    No contact info found. Try a clearer image.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleUseContact}
                disabled={filledCount === 0}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <CheckCircle size={15} /> Review &amp; Save Contact
              </button>
              <button onClick={onClose} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
