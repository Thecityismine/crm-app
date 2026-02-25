// Server-side Firestore write proxy.
// Bypasses the client SDK entirely by calling the Firestore REST API directly.
// This avoids WebSocket / gRPC transport issues in the browser.

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return { doubleValue: value }
  if (typeof value === 'string') return { stringValue: value }
  return { stringValue: String(value) }
}

function toFirestoreFields(obj) {
  const fields = {}
  for (const [key, value] of Object.entries(obj)) {
    fields[key] = toFirestoreValue(value)
  }
  return fields
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { operation, collection, docId, data, idToken } = req.body

  if (!idToken) return res.status(400).json({ error: 'Missing idToken' })
  if (!operation) return res.status(400).json({ error: 'Missing operation' })
  if (!collection) return res.status(400).json({ error: 'Missing collection' })

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID
  if (!projectId) return res.status(500).json({ error: 'Firebase project not configured' })

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`
  const now = new Date().toISOString()
  const headers = {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  }

  try {
    let response

    if (operation === 'create') {
      const fields = toFirestoreFields(data || {})
      fields.createdAt = { timestampValue: now }
      fields.updatedAt = { timestampValue: now }

      response = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fields }),
      })

    } else if (operation === 'update') {
      if (!docId) return res.status(400).json({ error: 'Missing docId for update' })

      const fields = toFirestoreFields(data || {})
      fields.updatedAt = { timestampValue: now }

      // updateMask ensures we only patch the specified fields (not replace the whole doc)
      const maskParams = Object.keys(fields)
        .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
        .join('&')

      response = await fetch(`${baseUrl}/${docId}?${maskParams}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields }),
      })

    } else if (operation === 'delete') {
      if (!docId) return res.status(400).json({ error: 'Missing docId for delete' })

      response = await fetch(`${baseUrl}/${docId}`, {
        method: 'DELETE',
        headers,
      })

      if (!response.ok) {
        const result = await response.json()
        console.error('Firestore delete error:', result)
        return res.status(response.status).json({ error: result.error?.message || 'Delete failed' })
      }
      return res.status(200).json({ success: true })

    } else {
      return res.status(400).json({ error: `Unknown operation: ${operation}` })
    }

    const result = await response.json()

    if (!response.ok) {
      console.error('Firestore REST error:', JSON.stringify(result))
      return res.status(response.status).json({
        error: result.error?.message || 'Firestore write failed',
      })
    }

    // For create, extract the new document ID from the returned resource name
    const id = result.name?.split('/').pop()
    return res.status(200).json({ id })

  } catch (err) {
    console.error('firestore-write handler error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
