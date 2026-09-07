import React, { useState } from 'react'

export default function Lobby({ onJoin }) {
  const [roomId, setRoomId] = useState(() => Math.random().toString(36).slice(2, 8))

  function handleSubmit(e) {
    e.preventDefault()
    if (!roomId) return
    onJoin(roomId)
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', marginBottom: 6 }}>Room ID</label>
      <input value={roomId} onChange={e => setRoomId(e.target.value)} style={{ padding: 6, borderRadius: 6, border: '1px solid #666', marginRight: 8 }} />
      <button type="submit" style={{ padding: '6px 10px', borderRadius: 6 }}>Join Room</button>
    </form>
  )
}
