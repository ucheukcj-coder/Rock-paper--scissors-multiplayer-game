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
    <form onSubmit={handleSubmit} style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', marginBottom: 6 }}>Room ID</label>
      <input value={roomId} onChange={e => setRoomId(e.target.value)} style={{ padding: 6, borderRadius: 6, border: '1px solid #666', marginRight: 8 }} />
      <button type="submit" style={{ padding: '6px 10px', borderRadius: 6 }}>Join Room</button>
    </form>
  )
}
