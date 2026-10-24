import React, { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '../api'

function presenceClass(online) {
  return `presence-dot${online ? ' is-online' : ''}`
}

export default function FriendHome({ user, token, socket, onSignOut, onPlayComputer, onJoinGame }) {
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] })
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [incomingChallenge, setIncomingChallenge] = useState(null)
  const [outgoingChallenge, setOutgoingChallenge] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('play')
  const outgoingChallengeTimeoutRef = useRef(null)

  const loadSocial = useCallback(async () => {
    try {
      const [friendList, friendRequests] = await Promise.all([
        apiRequest('/friends', { token }),
        apiRequest('/friends/requests', { token }),
      ])
      setFriends(friendList)
      setRequests(friendRequests)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadSocial()
  }, [loadSocial])

  useEffect(() => {
    const query = search.trim()
    if (query.length < 2) {
      setResults([])
      return undefined
    }
    let cancelled = false
    const timeout = setTimeout(async () => {
      try {
        const found = await apiRequest(`/users/search?q=${encodeURIComponent(query)}`, { token })
        if (!cancelled) {
          setResults(found)
          setError('')
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError.message)
      }
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [search, token])

  useEffect(() => {
    if (!socket) return undefined
    const refresh = () => { void loadSocial() }
    const updatePresence = ({ userId, online }) => {
      setFriends(current => current.map(friend => friend.id === userId ? { ...friend, online } : friend))
    }
    const onChallenge = invitation => setIncomingChallenge(invitation)
    const onChallengeEnded = ({ challengeId }) => {
      setIncomingChallenge(current => current?.challengeId === challengeId ? null : current)
      setNotice('That challenge is no longer available.')
    }
    const onDeclined = () => {
      clearTimeout(outgoingChallengeTimeoutRef.current)
      outgoingChallengeTimeoutRef.current = null
      setOutgoingChallenge(null)
      setNotice('Your friend isn’t available for a match right now.')
    }
    socket.on('friends:update', refresh)
    socket.on('presence:update', updatePresence)
    socket.on('friend:challenge', onChallenge)
    socket.on('friend:challenge-expired', onChallengeEnded)
    socket.on('friend:challenge-declined', onDeclined)
    return () => {
      socket.off('friends:update', refresh)
      socket.off('presence:update', updatePresence)
      socket.off('friend:challenge', onChallenge)
      socket.off('friend:challenge-expired', onChallengeEnded)
      socket.off('friend:challenge-declined', onDeclined)
    }
  }, [socket, loadSocial])

  useEffect(() => () => clearTimeout(outgoingChallengeTimeoutRef.current), [])

  useEffect(() => {
    if (!profileOpen) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape') setProfileOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [profileOpen])

  async function sendFriendRequest(username) {
    setBusyId(username)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest('/friends/requests', { token, method: 'POST', body: { username } })
      setNotice(result.message)
      setSearch('')
      setResults([])
      await loadSocial()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  async function acceptFriendRequest(requestId) {
    setBusyId(requestId)
    setError('')
    try {
      await apiRequest(`/friends/requests/${requestId}/accept`, { token, method: 'POST' })
      setNotice('You’re friends now. Challenge them when they’re online.')
      await loadSocial()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  async function removeFriend(friend) {
    if (!window.confirm(`Remove @${friend.username} from your friends?`)) return
    setBusyId(friend.id)
    try {
      await apiRequest(`/friends/${friend.id}`, { token, method: 'DELETE' })
      setNotice(`@${friend.username} was removed from your friends.`)
      await loadSocial()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  function challengeFriend(friend) {
    if (!socket?.connected) {
      setError('Connecting to the game server. Try again in a moment.')
      return
    }
    setError('')
    setNotice('')
    clearTimeout(outgoingChallengeTimeoutRef.current)
    setOutgoingChallenge({ username: friend.username })
    socket.emit('friend:challenge', { friendId: friend.id }, response => {
      if (!response?.ok) {
        clearTimeout(outgoingChallengeTimeoutRef.current)
        outgoingChallengeTimeoutRef.current = null
        setOutgoingChallenge(null)
        setError(response?.message || 'Could not send the challenge')
        return
      }
      outgoingChallengeTimeoutRef.current = setTimeout(() => {
        setOutgoingChallenge(null)
        outgoingChallengeTimeoutRef.current = null
      }, 60_000)
      setNotice(`Challenge sent to @${friend.username}.`)
    })
  }

  function respondToChallenge(accept) {
    if (!socket?.connected || !incomingChallenge) {
      setError('The game server is not connected.')
      return
    }
    socket.emit('challenge:respond', { challengeId: incomingChallenge.challengeId, accept }, response => {
      if (!response?.ok) {
        setError(response?.message || 'Could not respond to the challenge')
        setIncomingChallenge(null)
        return
      }
      if (accept && response.roomId) onJoinGame(response.roomId)
      else setIncomingChallenge(null)
    })
  }

  const existingIds = new Set([
    ...friends.map(friend => friend.id),
    ...requests.incoming.map(item => item.user.id),
    ...requests.outgoing.map(item => item.user.id),
  ])

  function navigateToSection(section, target) {
    setActiveSection(section)
    if (target === 'profile') {
      setProfileOpen(true)
      return
    }
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="social-home">
      <header className="home-header">
        <div className="home-brand"><span className="brand-mark">✳</span><div><strong>RPS CLUB</strong><small>THE HEAD-TO-HEAD ARENA</small></div></div>
        <div className="account-menu">
          <button className="profile-trigger" onClick={() => setProfileOpen(true)} aria-label={`View profile for ${user.username}`} aria-haspopup="dialog">
            <span className="account-avatar">{user.username.slice(0, 1).toUpperCase()}</span>
            <span className="account-name">@{user.username}</span>
            <span className="profile-chevron" aria-hidden="true">⌄</span>
          </button>
          <button className="button-quiet" onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      {profileOpen && (
        <div className="profile-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setProfileOpen(false) }}>
          <section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title">
            <button className="profile-close" onClick={() => setProfileOpen(false)} aria-label="Close profile">×</button>
            <p className="eyebrow">PLAYER CARD</p>
            <div className="profile-avatar">{user.username.slice(0, 1).toUpperCase()}</div>
            <h2 id="profile-title">@{user.username}</h2>
            <p className="profile-handle">RPS CLUB PLAYER</p>
            <div className="profile-info">
              <div><span>Email address</span><strong>{user.email || 'Not available'}</strong></div>
              <div><span>Email status</span><strong className="profile-verified"><i />{user.emailVerified === false ? 'Not verified' : 'Verified'}</strong></div>
              <div><span>Member since</span><strong>{user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'RPS Club player'}</strong></div>
            </div>
            <button className="profile-done" onClick={() => setProfileOpen(false)}>Done</button>
          </section>
        </div>
      )}

      <div className="home-workspace">
        <aside className="home-sidebar" aria-label="Clubhouse navigation">
          <p className="eyebrow">YOUR CLUBHOUSE</p>
          <button className={activeSection === 'play' ? 'is-active' : ''} onClick={() => navigateToSection('play', 'home-play')}><span aria-hidden="true">⌂</span>Play</button>
          <button className={activeSection === 'find' ? 'is-active' : ''} onClick={() => navigateToSection('find', 'friend-search')}><span aria-hidden="true">⌕</span>Find players</button>
          <button className={activeSection === 'requests' ? 'is-active' : ''} onClick={() => navigateToSection('requests', 'friend-requests')}><span aria-hidden="true">♧</span>Requests{requests.incoming.length > 0 && <b>{requests.incoming.length}</b>}</button>
          <button className={activeSection === 'profile' ? 'is-active' : ''} onClick={() => navigateToSection('profile', 'profile')}><span aria-hidden="true">◉</span>My profile</button>
          <div className="sidebar-promo"><span aria-hidden="true">✊</span><strong>Good rivals.<br />Better friends.</strong><small>Keep it friendly in the club.</small><i><span className="presence-dot is-online" />You’re online</i></div>
        </aside>
        <div className="home-content">
      <section className="home-welcome" id="home-play">
        <div>
          <p className="eyebrow">THE FRIENDLY RIVALRY</p>
          <h1>Your people.<br /><span>Your next match.</span></h1>
          <p>Good games are better with friends. Pick a way to play.</p>
        </div>
        <div className="welcome-art" aria-hidden="true"><span>✊</span><i>✳</i><b>✌</b></div>
      </section>

      <section className="mode-cards" aria-label="Choose a game mode">
        <button className="mode-card mode-friends" onClick={() => document.getElementById('friends-panel')?.scrollIntoView({ behavior: 'smooth' })}>
          <span className="mode-icon" aria-hidden="true">♧</span>
          <span className="mode-card-copy"><strong>Challenge a friend</strong><small>Find your friends and settle the score.</small></span>
          <span className="mode-arrow" aria-hidden="true">↗</span>
        </button>
        <button className="mode-card mode-computer" onClick={onPlayComputer}>
          <span className="mode-icon" aria-hidden="true">◈</span>
          <span className="mode-card-copy"><strong>Play the computer</strong><small>Warm up with a quick solo match.</small></span>
          <span className="mode-arrow" aria-hidden="true">↗</span>
        </button>
      </section>

      {(error || notice) && <div className={`home-message${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || notice}<button onClick={() => { setError(''); setNotice('') }} aria-label="Dismiss">×</button></div>}
      {incomingChallenge && (
        <section className="challenge-invite" role="alert">
          <div><span className="invite-icon">✊</span><span><strong>@{incomingChallenge.fromUsername} wants to play!</strong><small>They’ve challenged you to a match.</small></span></div>
          <div className="invite-actions">
            <button className="button-secondary" onClick={() => respondToChallenge(false)}>Not now</button>
            <button className="button-primary" onClick={() => respondToChallenge(true)}>Accept challenge <span aria-hidden="true">↗</span></button>
          </div>
        </section>
      )}

      <section className="friends-panel" id="friends-panel">
        <div className="friends-main">
          <div className="section-heading">
            <div><p className="eyebrow">YOUR PEOPLE</p><h2>Friends <span className="count-pill">{friends.length}</span></h2></div>
            <span className="online-summary"><i className="presence-dot is-online" />{friends.filter(friend => friend.online).length} online</span>
          </div>
          <label className="friend-search" id="friend-search">
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search players by username…" aria-label="Search players by username" />
            {search && <button onClick={() => setSearch('')} aria-label="Clear search">×</button>}
          </label>
          {search.trim().length >= 2 && (
            <div className="search-results">
              {results.length ? results.map(player => (
                <div className="friend-row search-result" key={player.id}>
                  <span className="friend-avatar">{player.username.slice(0, 1).toUpperCase()}</span>
                  <span className="friend-details"><strong>@{player.username}</strong><small>RPS player</small></span>
                  <button className="button-secondary friend-action" disabled={existingIds.has(player.id) || busyId === player.username} onClick={() => sendFriendRequest(player.username)}>
                    {friends.some(friend => friend.id === player.id) ? 'Already friends' : requests.incoming.some(item => item.user.id === player.id) ? 'Check requests' : requests.outgoing.some(item => item.user.id === player.id) ? 'Request sent' : 'Add friend'}
                  </button>
                </div>
              )) : <p className="empty-state">{loading ? 'Loading players…' : 'No players found with that username.'}</p>}
            </div>
          )}
          <div className="friend-list">
            {loading ? <p className="empty-state">Loading your friends…</p> : friends.length ? friends.map(friend => (
              <div className="friend-row" key={friend.id}>
                <span className="friend-avatar">{friend.username.slice(0, 1).toUpperCase()}</span>
                <span className="friend-details"><strong>@{friend.username}</strong><small><i className={presenceClass(friend.online)} />{friend.online ? 'Online now' : 'Offline'}</small></span>
                {friend.online && <button className="button-primary friend-action" onClick={() => challengeFriend(friend)} disabled={Boolean(outgoingChallenge)}>Challenge <span aria-hidden="true">↗</span></button>}
                <button className="friend-more" onClick={() => removeFriend(friend)} aria-label={`Remove @${friend.username}`} title="Remove friend" disabled={busyId === friend.id}>···</button>
              </div>
            )) : !loading && <div className="empty-friends"><span aria-hidden="true">♧</span><strong>Your crew starts here.</strong><p>Search for a username above, add a friend, and challenge them when they’re online.</p></div>}
          </div>
          {outgoingChallenge && <p className="challenge-status">Waiting for @{outgoingChallenge.username} to accept…</p>}
        </div>
        <aside className="requests-side" id="friend-requests">
          <p className="eyebrow">SOCIAL</p>
          <h3>Friend requests <span className="count-pill">{requests.incoming.length}</span></h3>
          {requests.incoming.length ? requests.incoming.map(item => (
            <div className="request-item" key={item.id}>
              <span className="friend-avatar small">{item.user.username.slice(0, 1).toUpperCase()}</span>
              <span className="friend-details"><strong>@{item.user.username}</strong><small>Wants to connect</small></span>
              <button className="accept-button" onClick={() => acceptFriendRequest(item.id)} disabled={busyId === item.id} aria-label={`Accept @${item.user.username}`}>✓</button>
            </div>
          )) : <p className="requests-empty">No new requests.<br />You’re all caught up.</p>}
          {requests.outgoing.length > 0 && <p className="sent-requests">Sent requests: {requests.outgoing.map(item => `@${item.user.username}`).join(', ')}</p>}
        </aside>
      </section>
      <footer className="home-footer"><span>RPS CLUB</span><span>PLAY NICE. WIN FAIR.</span></footer>
        </div>
      </div>
    </main>
  )
}
