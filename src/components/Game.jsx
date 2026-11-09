import React, { useEffect, useRef, useState } from 'react'
import Header from './Header'
import ChoiceButtons from './ChoiceButtons'
import ResultDisplay from './ResultDisplay'
import ScoreBoard from './ScoreBoard'
import ResetButton from './ResetButton'
import RoundHistory from './RoundHistory'
import io from 'socket.io-client'
import { playClick, playWin, playLose, playDraw, resumeAudio } from '../sounds'
import AuthScreen from './AuthScreen'
import FriendHome from './FriendHome'
import { API_BASE, apiRequest } from '../api'
import { signOut } from 'firebase/auth'
import { firebaseAuth } from '../firebase'

const CHOICES = ['Rock', 'Paper', 'Scissors']
const QUICK_REACTIONS = ['👏', '😮', '😂', '👀']
const GIF_REACTIONS = [
  { id: 'clap', label: 'Clap', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
  { id: 'wow', label: 'Wow', url: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif' },
  { id: 'dance', label: 'Dance', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' },
  { id: 'thinking', label: 'Thinking', url: 'https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif' },
  { id: 'fireworks', label: 'Fireworks', url: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif' },
  { id: 'surprise', label: 'Surprise', url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif' },
]

function decide(user, comp) {
  if (!user) return ''
  if (user === comp) return 'Draw'
  if ((user === 'Rock' && comp === 'Scissors') || (user === 'Paper' && comp === 'Rock') || (user === 'Scissors' && comp === 'Paper')) {
    return 'You Win'
  }
  return 'You Lose'
}

export default function Game() {
  const socketRef = React.useRef(null)
  const roomIdRef = React.useRef('')
  const opponentSeenRef = React.useRef(false)
  const matchRecordedRef = React.useRef(false)
  const playerNameRef = React.useRef(localStorage.getItem('playerName') || '')
  const countdownRef = React.useRef(null)
  const reactionTimeoutRef = React.useRef(null)
  const reactionTimersRef = React.useRef({})
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken') || '')
  const [authUser, setAuthUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [gameSocket, setGameSocket] = useState(null)
  const [userChoice, setUserChoice] = useState('')
  const [computerChoice, setComputerChoice] = useState('')
  const [result, setResult] = useState('')
  const [userScore, setUserScore] = useState(0)
  const [computerScore, setComputerScore] = useState(0)
  const [roundHistory, setRoundHistory] = useState([])
  const [gameOver, setGameOver] = useState(false)
  const [rematchRequested, setRematchRequested] = useState(false)
  const [opponentRematchRequested, setOpponentRematchRequested] = useState(false)
  const [inRoom, setInRoom] = useState(false)
  const [computerMode, setComputerMode] = useState(false)
  const [roomId, setRoomId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [socketConnected, setSocketConnected] = useState(false)
  const [opponentConnected, setOpponentConnected] = useState(false)
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [roomPlayers, setRoomPlayers] = useState([])
  const [roomPlayerNames, setRoomPlayerNames] = useState({})
  const [userMadeChoice, setUserMadeChoice] = useState(false)
  const [opponentMade, setOpponentMade] = useState(false)
  const [opponentReaction, setOpponentReaction] = useState(null)
  const [reactionCards, setReactionCards] = useState([])
  const [gifPickerOpen, setGifPickerOpen] = useState(false)
  const [gifSearch, setGifSearch] = useState('')
  const [gifCategory, setGifCategory] = useState('all')
  const [gifCatalog, setGifCatalog] = useState([])
  const [countdownMs, setCountdownMs] = useState(0)
  const [countdownLeft, setCountdownLeft] = useState(0)
  const [soundOn, setSoundOn] = useState(true)
  const WIN_SCORE = 5

  const suggestedGifs = ['clap', 'wow', 'dance', 'celebrate', 'fireworks']
  const gifCategories = ['all', ...new Set(gifCatalog.map(item => item.category).filter(Boolean))]
  const allowedGifs = gifCatalog.filter(item => {
    if (item.premium && !authUser?.isPremium) return false
    if (!item.premium && !item.owned) return false
    return true
  })
  const visibleGifs = allowedGifs.filter(item => {
    const query = gifSearch.trim().toLowerCase()
    const matchesSearch = !query || item.name.toLowerCase().includes(query) || (item.tags || []).some(tag => tag.toLowerCase().includes(query))
    const matchesCategory = gifCategory === 'all' || item.category === gifCategory
    return matchesSearch && matchesCategory
  })

  function showReactionCard(reaction) {
    const senderId = reaction.from || reaction.senderId || 'remote'
    setReactionCards(current => {
      const next = [...current]
      const index = next.findIndex(item => item.senderId === senderId)
      const record = {
        ...reaction,
        id: reaction.id || `${senderId}-${Date.now()}`,
        senderId,
        senderName: reaction.senderName || 'Opponent',
        createdAt: Date.now(),
      }
      if (index >= 0) next[index] = record
      else next.push(record)
      return next.slice(-4)
    })
    if (reactionTimersRef.current[senderId]) clearTimeout(reactionTimersRef.current[senderId])
    reactionTimersRef.current[senderId] = setTimeout(() => {
      setReactionCards(current => current.filter(item => item.senderId !== senderId))
      delete reactionTimersRef.current[senderId]
    }, 4000)
  }

  useEffect(() => {
    if (!authToken) {
      setSocketConnected(false)
      setAuthLoading(false)
      return undefined
    }
    let cancelled = false
    apiRequest('/auth/me', { token: authToken })
      .then(user => {
        if (cancelled) return
        setAuthUser(user)
        playerNameRef.current = user.username
      })
      .catch(() => {
        if (cancelled) return
        localStorage.removeItem('authToken')
        setAuthToken('')
      })
      .finally(() => { if (!cancelled) setAuthLoading(false) })
    return () => { cancelled = true }
  }, [authToken])

  useEffect(() => {
    if (!authToken) return undefined
    let cancelled = false
    apiRequest('/store/catalog', { token: authToken })
      .then(result => {
        if (!cancelled) setGifCatalog(result.items || [])
      })
      .catch(() => {
        if (!cancelled) setGifCatalog([])
      })
    return () => { cancelled = true }
  }, [authToken])

  useEffect(() => {
    return () => {
      Object.values(reactionTimersRef.current).forEach(timer => clearTimeout(timer))
      if (countdownRef.current) clearInterval(countdownRef.current)
      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current)
    }
  }, [])

  function handleAuthenticated(session) {
    localStorage.setItem('authToken', session.token)
    localStorage.setItem('playerName', session.user.username)
    playerNameRef.current = session.user.username
    setAuthToken(session.token)
    setAuthUser(session.user)
    setAuthLoading(false)
  }

  function handleSignOut() {
    void signOut(firebaseAuth).catch(error => console.warn('Firebase sign-out did not complete:', error))
    if (socketRef.current && roomIdRef.current) socketRef.current.emit('leaveRoom', roomIdRef.current)
    if (socketRef.current) socketRef.current.disconnect()
    localStorage.removeItem('authToken')
    setAuthToken('')
    setAuthUser(null)
    setInRoom(false)
    setRoomId('')
    roomIdRef.current = ''
    setOpponentConnected(false)
    handleReset()
  }

  useEffect(() => {
    if (!authToken) {
      setSocketConnected(false)
      return undefined
    }
    const socketUrl = API_BASE
    if (!socketUrl) {
      console.error('VITE_API_URL or VITE_SOCKET_URL is not configured for this deployment')
      return undefined
    }
    const s = io(socketUrl, { auth: { token: authToken } })
    socketRef.current = s
    setGameSocket(s)
    s.on('connect', () => {
      setSocketConnected(true)
      setPlayerId(s.id)
      if (roomIdRef.current) s.emit('joinRoom', { roomId: roomIdRef.current, name: playerNameRef.current })
    })
    s.on('disconnect', () => {
      setSocketConnected(false)
      setOpponentConnected(false)
      setWaiting(false)
      setUserMadeChoice(false)
    })
    s.on('connect_error', (error) => {
      setSocketConnected(false)
      console.error('Socket connection failed:', error.message)
    })
    s.on('friend:challenge-accepted', ({ roomId: acceptedRoomId }) => handleJoin(acceptedRoomId))
    s.on('roomUpdate', (room) => {
      setRoomPlayers(room.players || [])
      setRoomPlayerNames(room.names || {})
      const connectedToRoom = room.players?.length === 2 && room.players.includes(s.id)
      setOpponentConnected(Boolean(connectedToRoom))
      if (connectedToRoom) {
        opponentSeenRef.current = true
        setOpponentDisconnected(false)
      } else if (room.players?.length === 1 && opponentSeenRef.current) {
        setOpponentDisconnected(true)
      }
    })
    s.on('opponentMadeChoice', (id) => {
      if (id !== s.id) setOpponentMade(true)
    })
    s.on('opponentReaction', (reaction) => {
      if (reaction.kind === 'gif' || reaction.gifId || reaction.gifUrl) {
        showReactionCard({
          senderId: reaction.from || 'opponent',
          senderName: reaction.senderName || 'Opponent',
          gifUrl: reaction.gifUrl || GIF_REACTIONS.find(item => item.id === reaction.gif)?.url || '',
          kind: 'gif',
          premium: Boolean(reaction.premium),
        })
        return
      }
      setOpponentReaction(reaction)
      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current)
      reactionTimeoutRef.current = setTimeout(() => {
        setOpponentReaction(null)
        reactionTimeoutRef.current = null
      }, 4000)
    })
    s.on('startCountdown', ({ duration, deadline }) => {
      const synchronizedDeadline = Number(deadline) || Date.now() + duration
      setCountdownMs(duration)
      setCountdownLeft(Math.max(0, synchronizedDeadline - Date.now()))
      if (countdownRef.current) clearInterval(countdownRef.current)
      countdownRef.current = setInterval(() => {
        const left = Math.max(0, synchronizedDeadline - Date.now())
        setCountdownLeft(left)
        if (left <= 0) {
          clearInterval(countdownRef.current)
          countdownRef.current = null
        }
      }, 100)
    })
    s.on('waitingForOpponent', () => setWaiting(true))
    s.on('choicesRevealed', (choices) => {
      setWaiting(false)
      setUserMadeChoice(false)
      setOpponentMade(false)
      setCountdownLeft(0)
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
      const meChoice = choices[s.id]
      const otherId = Object.keys(choices).find(id => id !== s.id)
      const otherChoice = otherId ? choices[otherId] : ''
      setUserChoice(meChoice || '')
      setComputerChoice(otherChoice || '')
      recordResult(meChoice, otherChoice)
    })
    s.on('roundCancelled', () => {
      setWaiting(false)
      setUserMadeChoice(false)
      setOpponentMade(false)
      setUserChoice('')
      setComputerChoice('')
      setCountdownLeft(0)
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    })
    s.on('rematchUpdate', (readyPlayers) => {
      setRematchRequested(readyPlayers.includes(s.id))
      setOpponentRematchRequested(readyPlayers.some(id => id !== s.id))
    })
    s.on('rematchStarted', () => {
      handleReset()
      setRematchRequested(false)
      setOpponentRematchRequested(false)
    })
    s.on('roomFull', () => alert('Room is full — please try another room id'))
    return () => {
      s.disconnect()
      if (socketRef.current === s) {
        socketRef.current = null
        setGameSocket(null)
      }
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current)
      Object.values(reactionTimersRef.current).forEach(timer => clearTimeout(timer))
    }
  }, [authToken])

  function handleChoose(choice) {
    if (!inRoom || userMadeChoice || gameOver) return
    setUserChoice(choice)
    setUserMadeChoice(true)
    if (soundOn) {
      resumeAudio().catch(() => {})
      playClick()
    }
    if (computerMode) {
      const opponentChoice = CHOICES[Math.floor(Math.random() * CHOICES.length)]
      setComputerChoice(opponentChoice)
      recordResult(choice, opponentChoice)
      setUserMadeChoice(false)
      return
    }
    socketRef.current.emit('playerChoice', { roomId, choice })
  }

  function handleQuickReaction(reaction) {
    if (!roomId || computerMode || !opponentConnected || !socketRef.current?.connected) return
    socketRef.current.emit('quickReaction', { roomId, reaction })
  }

  function handleGifReaction(gif) {
    if (!roomId || computerMode || !opponentConnected || !socketRef.current?.connected) return
    socketRef.current.emit('gifReaction', { roomId, gifId: gif.id }, response => {
      if (!response?.ok) {
        alert(response?.message || 'That GIF could not be sent.')
        return
      }
      showReactionCard({
        senderId: socketRef.current?.id || 'self',
        senderName: playerNameRef.current || 'You',
        gifUrl: gif.imageUrl || gif.url,
        kind: 'gif',
        premium: Boolean(gif.premium),
      })
      setGifSearch('')
      setGifCategory('all')
      setGifPickerOpen(false)
    })
  }

  function recordResult(meChoice, opponentChoice) {
    const roundResult = decide(meChoice, opponentChoice)
    setResult(roundResult)
    setRoundHistory(history => [...history, {
      round: history.length + 1,
      playerChoice: meChoice,
      opponentChoice,
      result: roundResult,
    }])
    if (soundOn) {
      if (roundResult === 'You Win') playWin()
      else if (roundResult === 'You Lose') playLose()
      else if (roundResult === 'Draw') playDraw()
    }
    if (roundResult === 'You Win') {
      setUserScore(score => {
        const next = score + 1
        if (next >= WIN_SCORE) {
          setGameOver(true)
          recordCompletedMatch(true)
        }
        return next
      })
    } else if (roundResult === 'You Lose') {
      setComputerScore(score => {
        const next = score + 1
        if (next >= WIN_SCORE) {
          setGameOver(true)
          recordCompletedMatch(false)
        }
        return next
      })
    }
  }

  function recordCompletedMatch(won) {
    if (matchRecordedRef.current) return
    matchRecordedRef.current = true
    void apiRequest('/matches/complete', { token: authToken, method: 'POST', body: { won } })
      .then(result => setAuthUser(current => current ? {
        ...current,
        totalWins: result.totalWins,
        matchesPlayed: result.matchesPlayed,
      } : current))
      .catch(error => console.error('Could not record completed match:', error.message))
  }

  function handleJoin(room) {
    if (!socketRef.current || !socketRef.current.connected) return
    setComputerMode(false)
    playerNameRef.current = authUser?.username || playerNameRef.current || 'You'
    socketRef.current.emit('joinRoom', { roomId: room })
    setRoomId(room)
    roomIdRef.current = room
    opponentSeenRef.current = false
    setOpponentDisconnected(false)
    setInRoom(true)
  }

  function handlePlayComputer() {
    playerNameRef.current = authUser?.username || 'You'
    setComputerMode(true)
    setRoomId('FRIENDLY MATCH')
    setOpponentConnected(true)
    setInRoom(true)
    handleReset()
  }

  function handleLeave() {
    if (socketRef.current && roomIdRef.current) socketRef.current.emit('leaveRoom', roomIdRef.current)
    setInRoom(false)
    setRoomId('')
    roomIdRef.current = ''
    opponentSeenRef.current = false
    setOpponentDisconnected(false)
    setComputerMode(false)
    setOpponentConnected(false)
    setWaiting(false)
    setRematchRequested(false)
    setOpponentRematchRequested(false)
    handleReset()
  }

  function handleRematch() {
    if (!gameOver || rematchRequested || !socketRef.current?.connected) return
    setRematchRequested(true)
    socketRef.current.emit('requestRematch', roomId)
  }

  function handleReset() {
    matchRecordedRef.current = false
    setUserChoice('')
    setComputerChoice('')
    setResult('')
    setUserScore(0)
    setComputerScore(0)
    setRoundHistory([])
    setGameOver(false)
    setRematchRequested(false)
    setOpponentRematchRequested(false)
    setWaiting(false)
    setUserMadeChoice(false)
    setOpponentMade(false)
    setCountdownLeft(0)
  }

  const opponentName = computerMode ? 'Computer' : roomPlayerNames[roomPlayers.find(id => id !== socketRef.current?.id)] || 'Opponent'

  return (
    <>
      {authLoading ? (
        <main className="auth-loading"><span className="auth-spinner" />Checking your player account…</main>
      ) : !authUser ? (
        <AuthScreen onAuthenticated={handleAuthenticated} />
      ) : !inRoom ? (
        <FriendHome
          user={authUser}
          token={authToken}
          socket={gameSocket}
          onSignOut={handleSignOut}
          onPlayComputer={handlePlayComputer}
          onJoinGame={handleJoin}
          onUserUpdated={setAuthUser}
        />
      ) : (
        <main className="app-shell">
          <header className="app-header">
            <Header />
            <div className={'connection-state' + (socketConnected ? ' is-online' : ' is-offline')} role="status">
              <span className="state-dot" />{socketConnected ? 'Server online' : 'Reconnecting'}
            </div>
          </header>
          {!socketConnected && (
            <div className="notice reconnect-notice" role="status">Connection lost. Reconnecting to your match…</div>
          )}
          <section className="match-view">
            <div className="match-toolbar">
              <div className="room-block">
                <div className="room-token"><span className="meta-label">PRIVATE MATCH</span><span className="room-code">{computerMode ? 'Computer practice' : `${playerNameRef.current} vs. ${opponentName}`}</span></div>
                <div className={'match-state' + (opponentConnected ? ' is-online' : '')}><span className="state-dot" />{computerMode ? 'Computer ready' : opponentConnected ? 'Opponent connected' : 'Waiting for opponent'}</div>
              </div>
              <div className="toolbar-actions"><button className="button-quiet" onClick={handleLeave}>← Back to clubhouse</button></div>
            </div>

            {!computerMode && socketConnected && opponentDisconnected && (
              <div className="notice reconnect-notice" role="status">Your friend disconnected. Waiting for them to reconnect.</div>
            )}

            <div className="match-layout">
              <div className="match-main">
                <div className="round-strip">
                  <div className="round-note">
                    <span className="state-dot" />
                    <span>{computerMode ? <><strong>Computer ready</strong> · choose your move</> : waiting ? <><strong>Round resolving</strong> · waiting for reveal</> : userMadeChoice ? <><strong>Move locked</strong> · waiting on opponent</> : opponentConnected ? <><strong>Both players ready</strong> · choose your move</> : opponentDisconnected ? <>Waiting for your friend to reconnect</> : <>Waiting for your friend to join</>}</span>
                  </div>
                  {countdownLeft > 0 && (
                    <div className="countdown">
                      <div className="countdown-track"><div className="countdown-fill" style={{ width: `${Math.round((countdownLeft / countdownMs) * 100)}%` }} /></div>
                      <span>{Math.ceil(countdownLeft / 1000)}s</span>
                    </div>
                  )}
                </div>

                {!computerMode && opponentConnected && (
                  <div className="quick-reaction-row">
                    <span>React</span>
                    <div className="quick-reaction-buttons" role="group" aria-label="Send a quick reaction">
                      {QUICK_REACTIONS.map(reaction => (
                        <button key={reaction} className="quick-reaction-button" type="button" onClick={() => handleQuickReaction(reaction)} aria-label={`Send ${reaction} reaction`}>{reaction}</button>
                      ))}
                    </div>
                    <button className="gif-picker-toggle" type="button" onClick={() => setGifPickerOpen(open => !open)} aria-expanded={gifPickerOpen}>GIF</button>
                    {gifPickerOpen && (
                      <div className="gif-picker-drawer" role="dialog" aria-label="Choose a GIF reaction">
                        <div className="gif-drawer-header">
                          <strong>GIF library</strong>
                          <button type="button" className="button-quiet" onClick={() => setGifPickerOpen(false)}>Close</button>
                        </div>
                        <div className="gif-search-box">
                          <input type="search" value={gifSearch} onChange={event => setGifSearch(event.target.value)} placeholder="Search your reactions" aria-label="Search GIFs" />
                        </div>
                        <div className="gif-suggested-searches">
                          {suggestedGifs.map(item => (
                            <button key={item} type="button" className="gif-tag" onClick={() => setGifSearch(item)}>{item}</button>
                          ))}
                        </div>
                        <div className="gif-category-strip">
                          {gifCategories.map(item => (
                            <button key={item} type="button" className={gifCategory === item ? 'is-selected' : ''} onClick={() => setGifCategory(item)}>{item}</button>
                          ))}
                        </div>
                        <div className="gif-grid">
                          {visibleGifs.length ? visibleGifs.map(item => (
                            <button key={item.id} type="button" className="gif-card" onClick={() => handleGifReaction(item)} aria-label={`Send ${item.name}`}>
                              <img src={item.imageUrl} alt={item.name} />
                              <span>{item.name}</span>
                              {item.premium && <em>Premium</em>}
                            </button>
                          )) : <div className="gif-empty">No GIFs match your collection yet. Unlock or equip more reactions in the clubhouse.</div>}
                        </div>
                      </div>
                    )}
                    {opponentReaction && (
                      <span className="incoming-reaction" role="status">
                        {opponentReaction.gif ? <img src={GIF_REACTIONS.find(gif => gif.id === opponentReaction.gif)?.url} alt="GIF reaction" /> : opponentReaction.reaction}
                      </span>
                    )}
                  </div>
                )}

                <div className="reaction-display-area" aria-live="polite" aria-label="Received reactions">
                  {reactionCards.length ? reactionCards.map(item => (
                    <div key={item.id} className="reaction-item">
                      <div className="reaction-header"><span>{item.senderName}</span>{item.premium && <em>Premium</em>}</div>
                      {item.kind === 'gif' ? <img src={item.gifUrl} alt={`${item.senderName} reaction`} /> : <div className="emoji-reaction">{item.reaction}</div>}
                    </div>
                  )) : <div className="reaction-placeholder">Sent reactions appear here during the match.</div>}
                </div>

                {gameOver && (
                  <div className="match-winner-banner" role="status">
                    <div className="winner-copy">
                      <span className="meta-label">Match winner</span>
                      <strong>{userScore >= WIN_SCORE ? playerNameRef.current : roomPlayerNames[roomPlayers.find(id => id !== socketRef.current?.id)] || 'Opponent'} wins</strong>
                      <span className="rematch-note">{rematchRequested ? 'Waiting for your opponent...' : opponentRematchRequested ? 'Your opponent is ready for a rematch.' : 'Play another match?'}</span>
                    </div>
                    <button className="button-primary" onClick={handleRematch} disabled={rematchRequested || !opponentConnected}>{rematchRequested ? 'Waiting...' : 'Rematch'} <span aria-hidden="true">↻</span></button>
                  </div>
                )}

                <ScoreBoard userScore={userScore} computerScore={computerScore} userName={playerNameRef.current || 'You'} opponentName={opponentName} />
                <ResultDisplay userChoice={userChoice} computerChoice={computerChoice} result={result} opponentMade={opponentMade} opponentName={opponentName} opponentCaption={computerMode ? 'CPU opponent' : 'Guest player'} playerName={playerNameRef.current || 'You'} />

                <div className="decision-row">
                  <div>
                    <h2 className="decision-title">Choose your move</h2>
                    <ChoiceButtons onChoose={handleChoose} disabled={(!computerMode && !opponentConnected) || userMadeChoice || gameOver} userChoice={userChoice} />
                  </div>
                </div>

                <footer className="match-footer">
                  <div className="footer-actions">{!gameOver && <ResetButton onReset={handleReset} />}<label className="sound-toggle"><input type="checkbox" checked={soundOn} onChange={e => setSoundOn(e.target.checked)} /> Sound</label></div>
                  <div className="round-target">{gameOver ? 'MATCH COMPLETE' : 'FIRST TO 5 WINS'}</div>
                </footer>
              </div>
              <aside className="match-history"><RoundHistory rounds={roundHistory} opponentName={opponentName} /></aside>
            </div>
          </section>
        </main>
      )}
    </>
  )
}
