// Firebase configuration
// Replace with your Firebase project config from console.firebase.google.com
import { initializeApp } from 'firebase/app'
import { initializeFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

// experimentalForceLongPolling: forces HTTP long-polling for all Firestore
// traffic, bypassing WebSocket/gRPC entirely. Fixes write timeouts in
// environments where WebSockets are blocked or unreliable.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
})
export const auth = getAuth(app)
export const storage = getStorage(app)
export default app
