import { auth } from '@/config/firebase'
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  createUserWithEmailAndPassword,
} from 'firebase/auth'

const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly')
googleProvider.addScope('https://www.googleapis.com/auth/calendar.readonly')

export const loginWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password)

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider)

export const registerWithEmail = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password)

export const logout = () => signOut(auth)
