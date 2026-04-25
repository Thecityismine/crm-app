import { useState, useRef } from 'react'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/config/firebase'
import Modal from '@/components/ui/Modal'
import { Phone, Mail, Users, FileText, MessageSquare, AlertCircle, ImagePlus, X } from 'lucide-react'

const TYPES = [
  { value: 'call',    label: 'Call',    Icon: Phone },
  { value: 'email',   label: 'Email',   Icon: Mail },
  { value: 'meeting', label: 'Meeting', Icon: Users },
  { value: 'note',    label: 'Note',    Icon: FileText },
  { value: 'sms',     label: 'SMS',     Icon: MessageSquare },
]

const todayISO = () => new Date().toISOString().slice(0, 16)

function resizeImage(file, maxSide = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    }
    img.onerror = reject
    img.src = url
  })
}

export default function LogActivityModal({ onClose, onSave }) {
  const [type,       setType]       = useState('call')
  const [notes,      setNotes]      = useState('')
  const [occurredAt, setOccurredAt] = useState(todayISO())
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [imageFile,  setImageFile]  = useState(null)   // raw File
  const [imagePreview, setImagePreview] = useState('') // object URL for preview
  const fileInputRef = useRef()

  const handleImagePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      let imageURL = null
      if (imageFile) {
        let blob
        try {
          blob = await resizeImage(imageFile, 1200)
        } catch {
          blob = imageFile  // fallback: upload original if canvas resize fails
        }
        const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `activity-attachments/${Date.now()}_${safeName}`
        const sRef = storageRef(storage, path)
        await uploadBytes(sRef, blob, { contentType: 'image/jpeg' })
        imageURL = await getDownloadURL(sRef)
      }

      await onSave({
        type,
        notes:      notes.trim(),
        occurredAt: new Date(occurredAt).toISOString(),
        ...(imageURL ? { imageURL } : {}),
      })
      onClose()
    } catch (err) {
      const msg = err?.message ?? ''
      if (msg.includes('storage') || msg.includes('upload') || msg.includes('Firebase')) {
        setError('Photo upload failed. Check your connection and try again.')
      } else {
        setError(msg || 'Failed to save activity.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Log Activity" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type selector */}
        <div>
          <label className="label">Type</label>
          <div className="flex gap-2 flex-wrap">
            {TYPES.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  type === value
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[90px] resize-y"
            placeholder="What happened? Any key details..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Attachment */}
        <div>
          <label className="label">Attachment</label>
          {imagePreview ? (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="attachment preview"
                className="h-28 w-auto rounded-lg object-cover border border-gray-700"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center hover:bg-red-600 hover:border-red-600 transition-colors"
              >
                <X size={11} className="text-white" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-700 text-sm text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors"
            >
              <ImagePlus size={15} />
              Add photo
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />
        </div>

        {/* Date/time */}
        <div>
          <label className="label">Date & Time</label>
          <input
            className="input"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            required
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? (imageFile ? 'Uploading...' : 'Saving...') : 'Log Activity'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
