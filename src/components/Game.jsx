import React, { useState, useEffect } from 'react'
import Header from './Header'
import ChoiceButtons from './ChoiceButtons'
import ResultDisplay from './ResultDisplay'
import ScoreBoard from './ScoreBoard'
import ResetButton from './ResetButton'
import Lobby from './Lobby'
import RoundHistory from './RoundHistory'
import io from 'socket.io-client'
import { playClick, playWin, playLose, playDraw, playNotif, resumeAudio } from '../sounds'

const CHOICES = ['Rock', 'Paper', 'Scissors']
const QUICK_REACTIONS = ['👏', '😮', '😂', '👀']

function decide(user, comp) {
  if (!user) return ''
  if (user === comp) return 'Draw'
  if (
    (user === 'Rock' && comp === 'Scissors') ||
    (user === 'Paper' && comp === 'Rock') ||
    (user === 'Scissors' && comp === 'Paper')
  ) {
    return 'You Win'
  }
  return 'You Lose'
}

export default function Game() {
  const socketRef = React.useRef(null)
  const roomIdRef = React.useRef('')
  const opponentSeenRef = React.useRef(false)
  const playerNameRef = React.useRef(localStorage.getItem('playerName') || '')
  const [userChoice, setUserChoice] = useState('')
  const [computerChoice, setComputerChoice] = useState('')
  const [result, setResult] = useState('')
  const [userScore, setUserScore] = useState(0)
  const [computerScore, setComputerScore] = useState(0)
  const [roundHistory, setRoundHistory] = useState([])
  const [gameOver, setGameOver] = useState(false)
  const [rematchRequested, setRematchRequested] = useState(false)
  const [opponentRematchRequested, setOpponentRematchRequested] = useState(false)
  const WIN_SCORE = 5
  const [inRoom, setInRoom] = useState(false)
  const [computerMode, setComputerMode] = useState(false)
  const [roomId, setRoomId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [socketConnected, setSocketConnected] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [opponentConnected, setOpponentConnected] = useState(false)
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [roomPlayers, setRoomPlayers] = useState([])
  const [roomPlayerNames, setRoomPlayerNames] = useState({})
  const [userMadeChoice, setUserMadeChoice] = useState(false)
  const [opponentMade, setOpponentMade] = useState(false)
  const [opponentReaction, setOpponentReaction] = useState(null)
  const [countdownMs, setCountdownMs] = useState(0)
  const [countdownLeft, setCountdownLeft] = useState(0)
  const countdownRef = React.useRef(null)
  const reactionTimeoutRef = React.useRef(null)
  const [soundOn, setSoundOn] = useState(true)

  useEffect(() => {
    // initialize socket once
    const socketUrl = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '')
    if (!socketUrl) {
      console.error('VITE_SOCKET_URL is not configured for this deployment')
      return
    }
    socketRef.current = io(socketUrl)
    const s = socketRef.current
    s.on('connect', () => {
      setSocketConnected(true)
      setPlayerId(s.id)
      // attempt to rejoin existing room after reconnect
      if (roomIdRef.current) {
        s.emit('joinRoom', { roomId: roomIdRef.current, name: playerNameRef.current })
      }
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
    s.on('roomUpdate', (room) => {
      console.log('roomUpdate received', room)
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
      setOpponentReaction(reaction)
      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current)
      reactionTimeoutRef.current = setTimeout(() => {
        setOpponentReaction(null)
        reactionTimeoutRef.current = null
      }, 2200)
    })

    s.on('startCountdown', ({ by, duration }) => {
      // start local countdown timer
      setCountdownMs(duration)
      setCountdownLeft(duration)
      if (countdownRef.current) clearInterval(countdownRef.current)
      const start = Date.now()
      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - start
        const left = Math.max(0, duration - elapsed)
        setCountdownLeft(left)
        if (left <= 0) {
          clearInterval(countdownRef.current)
          countdownRef.current = null
        }
      }, 100)
    })
    s.on('waitingForOpponent', () => {
      setWaiting(true)
    })
    s.on('choicesRevealed', (choices) => {
      setWaiting(false)
      // clear per-player flags and countdown
      setUserMadeChoice(false)
      setOpponentMade(false)
      setCountdownLeft(0)
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
      // choices is { socketId: choice }
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

    s.on('roomFull', () => {
      alert('Room is full — please try another room id')
    })

    return () => {
      if (socketRef.current) socketRef.current.disconnect()
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current)
    }
  }, [])

  function handleChoose(choice) {
    if (!inRoom || userMadeChoice || gameOver) return
    setUserChoice(choice)
    // mark that this user has chosen and emit choice to server
    setUserMadeChoice(true)
    if (soundOn) {
      // resume audio context on user gesture if needed
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
    if (roundResult === 'You Win') setUserScore(score => {
      const next = score + 1
      if (next >= WIN_SCORE) setGameOver(true)
      return next
    })
    else if (roundResult === 'You Lose') setComputerScore(score => {
      const next = score + 1
      if (next >= WIN_SCORE) setGameOver(true)
      return next
    })
  }

  function handleJoin(room, name) {
    if (!socketRef.current || !socketRef.current.connected) return
    setComputerMode(false)
    playerNameRef.current = name
    socketRef.current.emit('joinRoom', { roomId: room, name })
    setRoomId(room)
    roomIdRef.current = room
    opponentSeenRef.current = false
    setOpponentDisconnected(false)
    setInRoom(true)
  }

  function handlePlayComputer(name) {
    playerNameRef.current = name
    if (name !== 'You') localStorage.setItem('playerName', name)
    setComputerMode(true)
    setRoomId('COMPUTER')
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

  async function handleCopyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    } catch (error) {
      console.error('Could not copy invite link:', error)
    }
  }

  function handleReset() {
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <Header />
        <div className={'connection-state' + (socketConnected ? ' is-online' : ' is-offline')} role="status">
          <span className="state-dot" />{socketConnected ? 'Server online' : 'Connecting'}
        </div>
      </header>
      {!socketConnected && import.meta.env.PROD && !import.meta.env.VITE_SOCKET_URL && (
        <div className="notice" role="alert">Multiplayer server URL is not configured for this deployment.</div>
      )}
      {!inRoom ? (
        <section className="lobby-stage">
          <div className="lobby-copy">
            <div className="eyebrow">Two players. One room. No takesies-backsies.</div>
            <h2 className="lobby-title">Make your<br /><span>move.</span></h2>
            <p className="lobby-subtitle">A quick head-to-head. Pick your room, bring a rival, and see who reads the game better.</p>
            <div className="lobby-art" aria-hidden="true">✊</div>
          </div>
          <Lobby onJoin={handleJoin} onPlayComputer={handlePlayComputer} />
        </section>
      ) : (
        <section className="match-view">
          <div className="match-toolbar">
            <div className="room-block">
              <div className="room-token"><span className="meta-label">{computerMode ? 'Mode' : 'Room'}</span><span className="room-code">{roomId}</span></div>
              <div className={'match-state' + (opponentConnected ? ' is-online' : '')}>
                <span className="state-dot" />{computerMode ? 'Computer ready' : opponentConnected ? 'Opponent connected' : 'Waiting for opponent'}
              </div>
              <div className="players-online">{computerMode ? '1P' : `${roomPlayers.length}/2`}</div>
            </div>
            <div className="toolbar-actions">
              {!computerMode && <button className="button-secondary" onClick={handleCopyInvite}>{inviteCopied ? 'Copied' : 'Copy invite link'} <span aria-hidden="true">↗</span></button>}
              <button className="button-quiet" onClick={handleLeave}>Leave room</button>
            </div>
          </div>

          {!computerMode && !socketConnected && (
            <div className="notice reconnect-notice" role="status">
              Connection lost. Reconnecting to room {roomId}… Keep this page open.
            </div>
          )}
          {!computerMode && socketConnected && opponentDisconnected && (
            <div className="notice reconnect-notice" role="status">
              Your opponent disconnected. Waiting for them to reconnect to room {roomId}.
            </div>
          )}

          <div className="round-strip">
            <div className="round-note">
              <span className="state-dot" />
              <span>{computerMode ? <><strong>Computer ready</strong> · choose your move</> : waiting ? <><strong>Round resolving</strong> · waiting for reveal</> : userMadeChoice ? <><strong>Move locked</strong> · waiting on opponent</> : opponentConnected ? <><strong>Both players ready</strong> · choose your move</> : opponentDisconnected ? <>Waiting for your opponent to reconnect</> : <>Share the invite to bring your opponent in</>}</span>
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
                  <button key={reaction} className="quick-reaction-button" type="button" onClick={() => handleQuickReaction(reaction)} aria-label={`Send ${reaction} reaction`}>
                    {reaction}
                  </button>
                ))}
              </div>
              {opponentReaction && (
                <span className="incoming-reaction" role="status">
                  {opponentReaction.name}: {opponentReaction.reaction}
                </span>
              )}
            </div>
          )}

          {gameOver && (
            <div className="match-winner-banner" role="status">
              <div className="winner-copy">
                <span className="meta-label">Match winner</span>
                <strong>{userScore >= WIN_SCORE ? playerNameRef.current : roomPlayerNames[roomPlayers.find(id => id !== socketRef.current?.id)] || 'Opponent'} wins</strong>
                <span className="rematch-note">{rematchRequested ? 'Waiting for your opponent...' : opponentRematchRequested ? 'Your opponent is ready for a rematch.' : 'Play another match?'}</span>
              </div>
              <button className="button-primary" onClick={handleRematch} disabled={rematchRequested || !opponentConnected}>
                {rematchRequested ? 'Waiting...' : 'Rematch'} <span aria-hidden="true">↻</span>
              </button>
            </div>
          )}

          <ResultDisplay userChoice={userChoice} computerChoice={computerChoice} result={result} opponentMade={opponentMade} opponentName={computerMode ? 'Computer' : roomPlayerNames[roomPlayers.find(id => id !== socketRef.current?.id)] || 'Opponent'} opponentCaption={computerMode ? 'CPU opponent' : 'Guest player'} playerName={playerNameRef.current || 'You'} />

          <div className="decision-row">
            <div>
              <h2 className="decision-title">Choose your move</h2>
              <ChoiceButtons onChoose={handleChoose} disabled={(!computerMode && !opponentConnected) || userMadeChoice || gameOver} userChoice={userChoice} />
            </div>
            <ScoreBoard userScore={userScore} computerScore={computerScore} />
          </div>

          <RoundHistory rounds={roundHistory} opponentName={computerMode ? 'Computer' : 'Opponent'} />

          <footer className="match-footer">
            <div className="footer-actions">
              {!gameOver && <ResetButton onReset={handleReset} />}
              <label className="sound-toggle"><input type="checkbox" checked={soundOn} onChange={e => setSoundOn(e.target.checked)} /> Sound</label>
            </div>
            <div className="round-target">{gameOver ? 'MATCH COMPLETE' : 'FIRST TO 5 WINS'}</div>
          </footer>
        </section>
      )}
    </main>
  )
}
