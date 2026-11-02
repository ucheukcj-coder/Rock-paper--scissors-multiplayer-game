import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyAZI_r0IspYDhXtBhxzPGb3EiFV5Tkkoaw',
  authDomain: 'my-rps-app-34895.firebaseapp.com',
  projectId: 'my-rps-app-34895',
  storageBucket: 'my-rps-app-34895.firebasestorage.app',
  messagingSenderId: '743517976382',
  appId: '1:743517976382:web:2f14c2ce1f48708a93de6f',
  measurementId: 'G-V8TVM014NP',
}

const app = initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(app)
export const googleAuthProvider = new GoogleAuthProvider()
