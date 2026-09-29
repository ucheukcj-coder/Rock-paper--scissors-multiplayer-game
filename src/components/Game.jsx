import React, { useState, useEffect } from 'react'
import Header from './Header'
import ChoiceButtons from './ChoiceButtons'
import ResultDisplay from './ResultDisplay'
import ScoreBoard from './ScoreBoard'
import ResetButton from './ResetButton'
import Lobby from './Lobby'
import io from 'socket.io-client'
import { playClick, playWin, playLose, playDraw, playNotif, resumeAudio } from '../sounds'

const CHOICES = ['Rock', 'Paper', 'Scissors']

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
  const [userChoice, setUserChoice] = useState('')
  const [computerChoice, setComputerChoice] = useState('')
  const [result, setResult] = useState('')
  const [userScore, setUserScore] = useState(0)
  const [computerScore, setComputerScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const WIN_SCORE = 5
  const [inRoom, setInRoom] = useState(false)
  const [roomId, setRoomId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [socketConnected, setSocketConnected] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [opponentConnected, setOpponentConnected] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [roomPlayers, setRoomPlayers] = useState([])
  const [userMadeChoice, setUserMadeChoice] = useState(false)
  const [opponentMade, setOpponentMade] = useState(false)
  const [countdownMs, setCountdownMs] = useState(0)
  const [countdownLeft, setCountdownLeft] = useState(0)
  const countdownRef = React.useRef(null)
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
        s.emit('joinRoom', roomIdRef.current)
      }
    })
    s.on('disconnect', () => setSocketConnected(false))
    s.on('connect_error', (error) => {
      setSocketConnected(false)
      console.error('Socket connection failed:', error.message)
    })
    s.on('roomUpdate', (room) => {
      console.log('roomUpdate received', room)
      setRoomPlayers(room.players || [])
      if (room.players && room.players.length === 2 && room.players.includes(s.id)) setOpponentConnected(true)
      else setOpponentConnected(false)
    })
    s.on('opponentMadeChoice', (id) => {
      if (id !== s.id) setOpponentMade(true)
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
      const res = decide(meChoice, otherChoice)
      setResult(res)
      // play appropriate sound
      if (soundOn) {
        if (res === 'You Win') playWin()
        else if (res === 'You Lose') playLose()
        else if (res === 'Draw') playDraw()
      }
      if (res === 'You Win') setUserScore(sco => {
        const next = sco + 1
        if (next >= WIN_SCORE) setGameOver(true)
        return next
      })
      else if (res === 'You Lose') setComputerScore(sco => {
        const next = sco + 1
        if (next >= WIN_SCORE) setGameOver(true)
        return next
      })
    })

    s.on('roomFull', () => {
      alert('Room is full — please try another room id')
    })

    return () => {
      if (socketRef.current) socketRef.current.disconnect()
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
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
    socketRef.current.emit('playerChoice', { roomId, choice })
  }

  function handleJoin(room) {
    if (!socketRef.current || !socketRef.current.connected) return
    socketRef.current.emit('joinRoom', room)
    setRoomId(room)
    roomIdRef.current = room
    setInRoom(true)
  }

  function handleLeave() {
    if (socketRef.current && roomIdRef.current) socketRef.current.emit('leaveRoom', roomIdRef.current)
    setInRoom(false)
    setRoomId('')
    roomIdRef.current = ''
    setOpponentConnected(false)
    setWaiting(false)
    handleReset()
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
    setGameOver(false)
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
          <Lobby onJoin={handleJoin} />
        </section>
      ) : (
        <section className="match-view">
          <div className="match-toolbar">
            <div className="room-block">
              <div className="room-token"><span className="meta-label">Room</span><span className="room-code">{roomId}</span></div>
              <div className={'match-state' + (opponentConnected ? ' is-online' : '')}>
                <span className="state-dot" />{opponentConnected ? 'Opponent connected' : 'Waiting for opponent'}
              </div>
              <div className="players-online">{roomPlayers.length}/2</div>
            </div>
            <div className="toolbar-actions">
              <button className="button-secondary" onClick={handleCopyInvite}>{inviteCopied ? 'Copied' : 'Copy invite link'} <span aria-hidden="true">↗</span></button>
              <button className="button-quiet" onClick={handleLeave}>Leave room</button>
            </div>
          </div>

          <div className="round-strip">
            <div className="round-note">
              <span className="state-dot" />
              <span>{waiting ? <><strong>Round resolving</strong> · waiting for reveal</> : userMadeChoice ? <><strong>Move locked</strong> · waiting on opponent</> : opponentConnected ? <><strong>Both players ready</strong> · choose your move</> : <>Share the invite to bring your opponent in</>}</span>
            </div>
            {countdownLeft > 0 && (
              <div className="countdown">
                <div className="countdown-track"><div className="countdown-fill" style={{ width: `${Math.round((countdownLeft / countdownMs) * 100)}%` }} /></div>
                <span>{Math.ceil(countdownLeft / 1000)}s</span>
              </div>
            )}
          </div>

          <ResultDisplay userChoice={userChoice} computerChoice={computerChoice} result={result} opponentMade={opponentMade} />

          <div className="decision-row">
            <div>
              <h2 className="decision-title">Choose your move</h2>
              <ChoiceButtons onChoose={handleChoose} disabled={!opponentConnected || userMadeChoice || gameOver} userChoice={userChoice} />
            </div>
            <ScoreBoard userScore={userScore} computerScore={computerScore} />
          </div>

          <footer className="match-footer">
            <div className="footer-actions">
              <ResetButton onReset={handleReset} />
              <label className="sound-toggle"><input type="checkbox" checked={soundOn} onChange={e => setSoundOn(e.target.checked)} /> Sound</label>
            </div>
            <div className="round-target">{gameOver ? 'MATCH COMPLETE' : 'FIRST TO 5 WINS'}</div>
          </footer>
        </section>
      )}
    </main>
  )
}
