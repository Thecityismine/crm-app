// Firebase Storage uploads over the REST API.
//
// The Storage SDK hangs on this project's setup, so every upload here is a
// hand-rolled REST call — and that call had been written out three times
// (contact photos, activity attachments, profile photos), each with its own
// canvas resize alongside it. Memories make a fourth, with more than one photo
// per record. One copy now.
//
// Callers keep their own resize parameters: a profile avatar wants 400px, an
// activity attachment 1200, a memory photo more than either. Only the
// mechanics are shared.

import { auth } from '@/config/firebase'

const bucket = () => import.meta.env.VITE_FIREBASE_STORAGE_BUCKET

/**
 * Downscale an image through a canvas and re-encode it as JPEG.
 * Only ever shrinks — `scale` is capped at 1, so a small photo is left alone.
 */
export function resizeImage(file, maxSide = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null'))),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    img.src = url
  })
}

/**
 * Upload bytes to `storagePath` and return a download URL.
 *
 * The URL carries the token Storage hands back on upload, which is what makes
 * it readable by an <img> tag with no SDK and no signed-URL round trip.
 */
export async function uploadToStorage(blob, storagePath, contentType = 'image/jpeg') {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  const idToken = await user.getIdToken()
  const encoded = encodeURIComponent(storagePath)

  const res = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${bucket()}/o?uploadType=media&name=${encoded}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': contentType },
      body: blob,
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Upload failed (${res.status})`)
  }
  const data = await res.json()
  return `https://firebasestorage.googleapis.com/v0/b/${bucket()}/o/${encoded}?alt=media&token=${data.downloadTokens}`
}

/** Strip anything that would make a storage path awkward to read back. */
export function safeFileName(name = 'file') {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Resize and upload one image, returning its download URL.
 * `dir` is the storage folder; the name is timestamped to avoid collisions.
 */
export async function uploadImage(file, { dir, maxSide = 1600, quality = 0.85 } = {}) {
  const blob = await resizeImage(file, maxSide, quality)
  return uploadToStorage(blob, `${dir}/${Date.now()}_${safeFileName(file.name)}`)
}
