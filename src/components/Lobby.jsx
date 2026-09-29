import React, { useState } from 'react'

export default function Lobby({ onJoin }) {
  const [roomId, setRoomId] = useState(() => new URLSearchParams(window.location.search).get('room') || Math.random().toString(36).slice(2, 8))
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '')

  function handleSubmit(e) {
    e.preventDefault()
    const normalizedRoomId = roomId.trim()
    const normalizedPlayerName = playerName.trim().slice(0, 20)
    if (!normalizedRoomId || !normalizedPlayerName) return
    localStorage.setItem('playerName', normalizedPlayerName)
    const inviteUrl = new URL(window.location.href)
    inviteUrl.searchParams.set('room', normalizedRoomId)
    window.history.replaceState({}, '', inviteUrl)
    onJoin(normalizedRoomId, normalizedPlayerName)
  }

  return (
    <form className="lobby-form" onSubmit={handleSubmit}>
      <label htmlFor="player-name">Your name</label>
      <input id="player-name" className="lobby-input name-input" value={playerName} onChange={e => setPlayerName(e.target.value)} maxLength={20} placeholder="e.g. Alex" autoComplete="nickname" required />
      <label htmlFor="room-id">Room code</label>
      <div className="lobby-fields">
        <input id="room-id" className="lobby-input" value={roomId} onChange={e => setRoomId(e.target.value)} maxLength={32} required />
        <button className="button-primary" type="submit">Enter arena <span aria-hidden="true">↗</span></button>
      </div>
      <p className="lobby-form-note">Joining a shared room code pairs you with your opponent.</p>
    </form>
  )
}
