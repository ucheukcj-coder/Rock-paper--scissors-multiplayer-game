import React, { useState } from 'react'
import { apiRequest } from '../api'

export default function AuthScreen({ onAuthenticated }) {
  const [isRegistering, setIsRegistering] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [verificationHint, setVerificationHint] = useState('')
  const [isRequestingPasswordReset, setIsRequestingPasswordReset] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mobileAuthOpen, setMobileAuthOpen] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (isVerifying) {
        const session = await apiRequest('/auth/verify-email', {
          method: 'POST',
          body: { email, code: verificationCode },
        })
        onAuthenticated(session)
      } else if (isResettingPassword) {
        const session = await apiRequest('/auth/reset-password', {
          method: 'POST',
          body: { email, code: verificationCode, password },
        })
        onAuthenticated(session)
      } else if (isRequestingPasswordReset) {
        const result = await apiRequest('/auth/request-password-reset', {
          method: 'POST',
          body: { email },
        })
        setIsRequestingPasswordReset(false)
        setIsResettingPassword(true)
        setVerificationSent(true)
        setVerificationHint(result.developmentCodeInServerLog
          ? 'Local testing: the reset code is printed in the server terminal.'
          : 'If that email belongs to a verified account, a reset code is on its way.')
      } else {
        const result = await apiRequest(`/auth/${isRegistering ? 'register' : 'login'}`, {
          method: 'POST',
          body: isRegistering ? { username, email, password } : { username, password },
        })
        if (isRegistering && result.verificationRequired) {
          setIsVerifying(true)
          setVerificationSent(true)
          setVerificationHint(result.emailDeliveryFailed
            ? 'We could not send the email yet. Check the server email settings, then use Resend code.'
            : result.developmentCodeInServerLog
              ? 'Local testing: the code is printed in the server terminal.'
              : 'A 6-digit code is on its way to your inbox.')
          setError('')
        } else {
          onAuthenticated(result)
        }
      }
    } catch (requestError) {
      if (requestError.details?.verificationRequired && requestError.details.email) {
        setEmail(requestError.details.email)
        setIsRegistering(true)
        setIsVerifying(true)
        setVerificationSent(true)
        setVerificationHint('Your account still needs email verification. Check your inbox or request a new code.')
        setError('')
        return
      }
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function resendCode() {
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest('/auth/resend-verification', {
        method: 'POST',
        body: { email },
      })
      setVerificationSent(true)
      setVerificationHint(result.emailDeliveryFailed
        ? 'We could not send the email yet. Check the server email settings and try again.'
        : result.developmentCodeInServerLog
          ? 'Local testing: the new code is printed in the server terminal.'
          : result.message)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function resendPasswordResetCode() {
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest('/auth/request-password-reset', {
        method: 'POST',
        body: { email },
      })
      setVerificationHint(result.developmentCodeInServerLog
        ? 'Local testing: the new reset code is printed in the server terminal.'
        : 'If that email belongs to a verified account, a new reset code is on its way.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  function returnToSignIn() {
    setIsVerifying(false)
    setIsRequestingPasswordReset(false)
    setIsResettingPassword(false)
    setIsRegistering(false)
    setVerificationCode('')
    setVerificationHint('')
    setError('')
  }

  return (
    <main className={`auth-page${mobileAuthOpen ? ' show-mobile-auth' : ''}`}>
      <section className="auth-promo">
        <div className="auth-mark" aria-hidden="true">✳</div>
        <p className="eyebrow">The head-to-head arena</p>
        <h1>Good hands.<br /><span>Great rivals.</span></h1>
        <p className="auth-description">Your friends. Three moves.<br />First to five wins takes the bragging rights.</p>
        <div className="auth-orbit" aria-hidden="true">
          <span>✊</span><span>✋</span><span>✌</span>
        </div>
        <button className="auth-mobile-continue" type="button" onClick={() => setMobileAuthOpen(true)}>
          Sign in or create an account <span aria-hidden="true">↗</span>
        </button>
        <div className="auth-promo-foot">ROCK · PAPER · SCISSORS</div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-top">
          <button className="auth-mobile-back" type="button" onClick={() => setMobileAuthOpen(false)}>← Welcome</button>
          <span className="auth-logo">RPS<span>✳</span></span>
          <span className="auth-label">PLAYER ACCESS</span>
        </div>
        <div className="auth-form-wrap">
          <p className="eyebrow">
            {isVerifying || isResettingPassword ? 'One last step' : isRequestingPasswordReset ? 'Account recovery' : isRegistering ? 'Create your player account' : 'Welcome back'}
          </p>
          <h2>
            {isVerifying ? 'Check your inbox.' : isResettingPassword ? 'Choose a new password.' : isRequestingPasswordReset ? 'Forgot your password?' : isRegistering ? 'Join the arena.' : 'Ready for a rematch?'}
          </h2>
          <p className="auth-form-intro">
            {isVerifying
              ? `Enter the 6-digit code sent to ${email}. It expires in 15 minutes.`
              : isResettingPassword
                ? `Enter the 6-digit reset code sent to ${email} and choose a new password.`
                : isRequestingPasswordReset
                  ? 'Enter the email address linked to your verified account and we’ll send a reset code.'
                  : isRegistering
                    ? 'Claim your username and find your friends.'
                    : 'Sign in and see who’s around.'}
          </p>
          {(isVerifying || isResettingPassword) && verificationHint && <p className="verification-hint" role="status">{verificationHint}</p>}
          <form className="auth-form" onSubmit={handleSubmit}>
            {isVerifying || isResettingPassword ? (
              <>
                <label htmlFor="auth-verification-code">{isResettingPassword ? 'Password reset code' : 'Email verification code'}</label>
                <input
                  id="auth-verification-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={verificationCode}
                  onChange={event => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  required
                />
                {isResettingPassword && (
                  <>
                    <label htmlFor="auth-password">New password</label>
                    <input
                      id="auth-password"
                      type="password"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      minLength={8}
                      maxLength={72}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      required
                    />
                  </>
                )}
              </>
            ) : isRequestingPasswordReset ? (
              <>
                <label htmlFor="auth-email">Email address</label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  maxLength={254}
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </>
            ) : (
              <>
                <label htmlFor="auth-username">Username</label>
                <input
                  id="auth-username"
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                  minLength={3}
                  maxLength={20}
                  pattern="[A-Za-z0-9_]+"
                  title="Use 3–20 letters, numbers, or underscores"
                  autoComplete="username"
                  placeholder="yourname"
                  required
                />
                {isRegistering && (
                  <>
                    <label htmlFor="auth-email">Email address</label>
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      maxLength={254}
                      autoComplete="email"
                      placeholder="you@example.com"
                      required
                    />
                  </>
                )}
                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  minLength={8}
                  maxLength={72}
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  placeholder="At least 8 characters"
                  required
                />
              </>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy
                ? 'One moment…'
                : isVerifying
                  ? 'Verify email'
                  : isResettingPassword
                    ? 'Reset password'
                    : isRequestingPasswordReset
                      ? 'Send reset code'
                      : isRegistering
                        ? 'Create account'
                        : 'Sign in'}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          {isVerifying ? (
            <div className="auth-verification-actions">
              <button type="button" disabled={busy || !verificationSent} onClick={resendCode}>Resend code</button>
              <button type="button" onClick={() => { returnToSignIn(); setIsRegistering(false) }}>Back to sign in</button>
            </div>
          ) : isResettingPassword ? (
            <div className="auth-verification-actions auth-reset-actions">
              <button type="button" disabled={busy} onClick={resendPasswordResetCode}>Resend reset code</button>
              <button type="button" disabled={busy} onClick={() => { setIsResettingPassword(false); setIsRequestingPasswordReset(true); setVerificationCode(''); setError('') }}>Use another email</button>
              <button type="button" disabled={busy} onClick={returnToSignIn}>Back to sign in</button>
            </div>
          ) : isRequestingPasswordReset ? (
            <div className="auth-verification-actions">
              <button type="button" onClick={returnToSignIn}>Back to sign in</button>
            </div>
          ) : (
            <>
              <p className="auth-switch">
                {isRegistering ? 'Already have an account?' : 'New around here?'}
                {' '}
                <button type="button" onClick={() => { setIsRegistering(value => !value); setError('') }}>
                  {isRegistering ? 'Sign in' : 'Create an account'}
                </button>
              </p>
              {!isRegistering && (
                <p className="auth-switch auth-forgot-password">
                  <button type="button" onClick={() => { setIsRequestingPasswordReset(true); setError(''); setVerificationHint('') }}>
                    Forgot password?
                  </button>
                </p>
              )}
            </>
          )}
          <p className="auth-security-note"><span aria-hidden="true">◈</span> Your password is securely hashed and never shown to other players.</p>
        </div>
      </section>
    </main>
  )
}
