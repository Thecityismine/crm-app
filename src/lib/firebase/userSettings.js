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
  const result = {}

  const opts = fields.relationshipOptions?.arrayValue?.values
  if (opts) {
    result.relationshipOptions = opts.map((v) => v.stringValue).filter(Boolean)
  }

  if (fields.pipelineTemplate?.stringValue) {
    result.pipelineTemplate = fields.pipelineTemplate.stringValue
  }

  if (fields.notificationPrefs?.mapValue?.fields) {
    const nf = fields.notificationPrefs.mapValue.fields
    result.notificationPrefs = {
      followUpReminders: nf.followUpReminders?.booleanValue ?? true,
      dealAlerts:        nf.dealAlerts?.booleanValue ?? true,
      weeklyDigest:      nf.weeklyDigest?.booleanValue ?? false,
    }
  }

  return Object.keys(result).length ? result : null
}

export async function saveUserSettings(settings) {
  const token = await getToken()
  if (!token) return

  const uid = auth.currentUser.uid
  const fields = {}
  const fieldPaths = []

  if (settings.relationshipOptions) {
    fields.relationshipOptions = {
      arrayValue: {
        values: settings.relationshipOptions.map((v) => ({ stringValue: v })),
      },
    }
    fieldPaths.push('relationshipOptions')
  }

  if (settings.pipelineTemplate) {
    fields.pipelineTemplate = { stringValue: settings.pipelineTemplate }
    fieldPaths.push('pipelineTemplate')
  }

  if (settings.notificationPrefs) {
    fields.notificationPrefs = {
      mapValue: {
        fields: {
          followUpReminders: { booleanValue: !!settings.notificationPrefs.followUpReminders },
          dealAlerts:        { booleanValue: !!settings.notificationPrefs.dealAlerts },
          weeklyDigest:      { booleanValue: !!settings.notificationPrefs.weeklyDigest },
        },
      },
    }
    fieldPaths.push('notificationPrefs')
  }

  if (!fieldPaths.length) return

  const mask = fieldPaths.map((f) => `updateMask.fieldPaths=${f}`).join('&')
  await fetch(`${userUrl(uid)}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
}
