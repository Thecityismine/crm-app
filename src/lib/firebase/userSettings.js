import { auth } from '@/config/firebase'

const projectId = () => import.meta.env.VITE_FIREBASE_PROJECT_ID
const userUrl = (uid) =>
  `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/users/${uid}`

async function getToken() {
  if (!auth.currentUser) return null
  return auth.currentUser.getIdToken()
}

export async function loadUserSettings() {
  const token = await getToken()
  if (!token) return null

  const uid = auth.currentUser.uid
  const res = await fetch(userUrl(uid), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 404) return null
  if (!res.ok) return null

  const doc = await res.json()
  const fields = doc.fields || {}
  const opts = fields.relationshipOptions?.arrayValue?.values
  if (!opts) return null

  return {
    relationshipOptions: opts.map((v) => v.stringValue).filter(Boolean),
  }
}

export async function saveUserSettings(settings) {
  const token = await getToken()
  if (!token) return

  const uid = auth.currentUser.uid
  const fields = {
    relationshipOptions: {
      arrayValue: {
        values: settings.relationshipOptions.map((v) => ({ stringValue: v })),
      },
    },
  }

  await fetch(`${userUrl(uid)}?updateMask.fieldPaths=relationshipOptions`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
}
