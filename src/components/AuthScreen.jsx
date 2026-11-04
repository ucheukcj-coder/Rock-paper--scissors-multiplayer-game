import React, { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  getIdToken,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { apiRequest } from '../api'
import { firebaseAuth, googleAuthProvider } from '../firebase'

function friendlyAuthError(error) {
  const messages = {
    'auth/email-already-in-use': 'An account already uses that email address. Try signing in instead.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/user-not-found': 'No account was found with that email address.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/weak-password': 'Choose a password with at least 8 characters.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled. Try again when you are ready.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow popups and try again.',
    'auth/unauthorized-domain': 'This website domain is not authorized in your Firebase Authentication settings.',
    'auth/too-many-requests': 'Too many attempts. Wait a little and try again.',
    'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
  }
  return messages[error.code] || error.message || 'Authentication could not be completed.'
}

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingGoogleToken, setPendingGoogleToken] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mobileAuthOpen, setMobileAuthOpen] = useState(false)

  function validateUsername(value) {
    const normalized = value.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
      throw new Error('Username must be 3–20 characters using letters, numbers, or underscores.')
    }
    return normalized
  }

  async function finishBackendSignIn(firebaseToken, requestedUsername = '') {
    const session = await apiRequest('/auth/firebase-session', {
      method: 'POST',
      body: { firebaseToken, ...(requestedUsername ? { username: requestedUsername } : {}) },
    })
    if (session.requiresUsername) {
      setPendingGoogleToken(firebaseToken)
      setMode('google-username')
      setNotice('Choose a unique username to finish setting up your player account.')
      return
    }
    onAuthenticated(session)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'google-username') {
        const chosenUsername = validateUsername(username)
        await finishBackendSignIn(pendingGoogleToken, chosenUsername)
        return
      }

      if (mode === 'register') {
        const chosenUsername = validateUsername(username)
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password)
        await updateProfile(credential.user, { displayName: chosenUsername })
        await sendEmailVerification(credential.user)
        await signOut(firebaseAuth)
        setMode('login')
        setPassword('')
        setNotice(`A verification link has been sent to ${email.trim()}. Verify your email, then sign in here.`)
        return
      }

      if (mode === 'forgot') {
        await sendPasswordResetEmail(firebaseAuth, email.trim())
        setNotice(`If an account exists for ${email.trim()}, Firebase has sent a password-reset email.`)
        return
      }

      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user)
        await signOut(firebaseAuth)
        setNotice(`Please verify ${email.trim()} using the link in your inbox. A new verification email has been sent.`)
        return
      }
      const firebaseToken = await getIdToken(credential.user, true)
      await finishBackendSignIn(firebaseToken, credential.user.displayName || '')
    } catch (requestError) {
      setError(requestError.code ? friendlyAuthError(requestError) : requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleSignIn() {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const credential = await signInWithPopup(firebaseAuth, googleAuthProvider)
      const firebaseToken = await getIdToken(credential.user, true)
      await finishBackendSignIn(firebaseToken)
    } catch (requestError) {
      setError(requestError.code ? friendlyAuthError(requestError) : requestError.message)
    } finally {
      setBusy(false)
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setError('')
    setNotice('')
    setPassword('')
  }

  const isUsernameStep = mode === 'register' || mode === 'google-username'

  return (
    <main className={`auth-page${mobileAuthOpen ? ' show-mobile-auth' : ''}`}>
      <section className="auth-promo">
        <div className="auth-mark" aria-hidden="true">✳</div>
        <p className="eyebrow">The head-to-head arena</p>
        <h1>Good hands.<br /><span>Great rivals.</span></h1>
        <p className="auth-description">Your friends. Three moves.<br />First to five wins takes the bragging rights.</p>
        <div className="auth-orbit" aria-hidden="true"><span>✊</span><span>✋</span><span>✌</span></div>
        <button className="auth-mobile-continue" type="button" onClick={() => setMobileAuthOpen(true)}>Sign in or create an account <span aria-hidden="true">↗</span></button>
        <div className="auth-promo-foot">ROCK · PAPER · SCISSORS</div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-top">
          <button className="auth-mobile-back" type="button" onClick={() => setMobileAuthOpen(false)}>← Welcome</button>
          <span className="auth-logo">RPS<span>✳</span></span>
          <span className="auth-label">PLAYER ACCESS</span>
        </div>
        <div className="auth-form-wrap">
          <p className="eyebrow">{mode === 'register' ? 'Create your player account' : mode === 'forgot' ? 'Account recovery' : mode === 'google-username' ? 'One last step' : 'Welcome back'}</p>
          <h2>{mode === 'register' ? 'Join the arena.' : mode === 'forgot' ? 'Reset your password.' : mode === 'google-username' ? 'Claim your name.' : 'Ready for a rematch?'}</h2>
          <p className="auth-form-intro">
            {mode === 'register' ? 'Choose a unique username, email and password to get started.' : mode === 'forgot' ? 'Enter the email address linked to your account and we’ll send a reset link.' : mode === 'google-username' ? 'Choose the unique username other players will see.' : 'Sign in and see who’s around.'}
          </p>
          {notice && <p className="verification-hint" role="status">{notice}</p>}
          <form className="auth-form" onSubmit={handleSubmit}>
            {isUsernameStep && (
              <>
                <label htmlFor="auth-username">Username</label>
                <input id="auth-username" value={username} onChange={event => setUsername(event.target.value)} minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" title="Use 3–20 letters, numbers, or underscores" autoComplete="username" placeholder="yourname" required />
              </>
            )}
            {mode !== 'google-username' && (
              <>
                <label htmlFor="auth-email">Email address</label>
                <input id="auth-email" type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} autoComplete="email" placeholder="you@example.com" required />
              </>
            )}
            {(mode === 'login' || mode === 'register') && (
              <>
                <label htmlFor="auth-password">Password</label>
                <input id="auth-password" type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} maxLength={72} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="At least 8 characters" required />
              </>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? 'One moment…' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : mode === 'google-username' ? 'Continue' : 'Sign in'}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          {mode !== 'forgot' && mode !== 'google-username' && (
            <>
              <div className="auth-divider"><span>or</span></div>
              <button className="auth-google" type="button" disabled={busy} onClick={handleGoogleSignIn}><span aria-hidden="true">G</span> Continue with Google</button>
            </>
          )}
          {mode === 'google-username' ? (
            <div className="auth-verification-actions"><button type="button" onClick={() => switchMode('login')}>Back to sign in</button></div>
          ) : mode === 'forgot' ? (
            <div className="auth-verification-actions"><button type="button" onClick={() => switchMode('login')}>Back to sign in</button></div>
          ) : (
            <>
              <p className="auth-switch">{mode === 'register' ? 'Already have an account?' : 'New around here?'}{' '}<button type="button" onClick={() => switchMode(mode === 'register' ? 'login' : 'register')}>{mode === 'register' ? 'Sign in' : 'Create an account'}</button></p>
              {mode === 'login' && <p className="auth-switch"><button type="button" onClick={() => switchMode('forgot')}>Forgot password?</button></p>}
            </>
          )}
          <p className="auth-security-note"><span aria-hidden="true">✳</span> Your account is protected by Firebase Authentication.</p>
        </div>
      </section>
    </main>
  )
}
