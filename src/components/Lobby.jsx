import React, { useState } from 'react'

export default function Lobby({ onJoin }) {
  const [roomId, setRoomId] = useState(() => new URLSearchParams(window.location.search).get('room') || Math.random().toString(36).slice(2, 8))

  function handleSubmit(e) {
    e.preventDefault()
    const normalizedRoomId = roomId.trim()
    if (!normalizedRoomId) return
    const inviteUrl = new URL(window.location.href)
    inviteUrl.searchParams.set('room', normalizedRoomId)
    window.history.replaceState({}, '', inviteUrl)
    onJoin(normalizedRoomId)
  }

  return (
    <form className="lobby-form" onSubmit={handleSubmit}>
      <label htmlFor="room-id">Room code</label>
      <div className="lobby-fields">
        <input id="room-id" className="lobby-input" value={roomId} onChange={e => setRoomId(e.target.value)} maxLength={32} />
        <button className="button-primary" type="submit">Enter arena <span aria-hidden="true">↗</span></button>
      </div>
      <p className="lobby-form-note">Joining a shared room code pairs you with your opponent.</p>
    </form>
  )
}
