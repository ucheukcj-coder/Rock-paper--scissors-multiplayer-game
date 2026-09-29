import express from 'express'
import http from 'http'
import { Server } from 'socket.io'

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })
app.get('/healthz', (_req, res) => res.status(200).send('ok'))

// Simple room pairing: two players per room
// rooms map will store { players: [], choices: {}, timeoutId: null }
const rooms = new Map()

io.on('connection', (socket) => {
  console.log('conn', socket.id)

  socket.on('joinRoom', (roomId) => {
    console.log('joinRoom request', socket.id, roomId)
    if (typeof roomId !== 'string' || !roomId.trim()) return
    let room = rooms.get(roomId) || { players: [] }
    if (room.players.includes(socket.id)) {
      socket.join(roomId)
      socket.emit('roomUpdate', room)
      return
    }
    if (room.players.length >= 2) {
      socket.emit('roomFull')
      return
    }
    room.players.push(socket.id)
    rooms.set(roomId, room)
    socket.join(roomId)
    console.log('room updated', roomId, room)
    io.to(roomId).emit('roomUpdate', room)
  })

  socket.on('playerChoice', ({ roomId, choice }) => {
    console.log('playerChoice', socket.id, roomId, choice)
    const room = rooms.get(roomId)
    if (!room) return
    room.choices = room.choices || {}
    room.choices[socket.id] = choice

    // notify the room that one player made a choice and start countdown for the other
    const otherId = room.players.find(id => id !== socket.id)
    const COUNTDOWN_MS = 8000
    if (otherId) {
      // inform room which player made the choice
      io.to(roomId).emit('opponentMadeChoice', socket.id)
      // start countdown (sent to all for UI sync)
      io.to(roomId).emit('startCountdown', { by: socket.id, duration: COUNTDOWN_MS })

      // clear any existing timeout
      if (room.timeoutId) clearTimeout(room.timeoutId)

      // schedule auto-choice for the other player if they don't choose in time
      room.timeoutId = setTimeout(() => {
        // if other hasn't chosen yet, pick random
        room.choices = room.choices || {}
        if (!room.choices[otherId]) {
          const choices = ['Rock', 'Paper', 'Scissors']
          const rand = choices[Math.floor(Math.random() * choices.length)]
          room.choices[otherId] = rand
          console.log('auto-choice for', otherId, 'in room', roomId, '->', rand)
        }
        console.log('choices revealed (timeout)', roomId, room.choices)
        io.to(roomId).emit('choicesRevealed', room.choices)
        room.choices = {}
        room.timeoutId = null
      }, COUNTDOWN_MS)
    }

    // if both played already, reveal immediately
    if (Object.keys(room.choices).length === room.players.length) {
      if (room.timeoutId) {
        clearTimeout(room.timeoutId)
        room.timeoutId = null
      }
      console.log('choices revealed', roomId, room.choices)
      io.to(roomId).emit('choicesRevealed', room.choices)
      room.choices = {}
    }
  })

  socket.on('leaveRoom', (roomId) => {
    console.log('leaveRoom', socket.id, roomId)
    socket.leave(roomId)
    const room = rooms.get(roomId)
    if (room) {
      room.players = room.players.filter(id => id !== socket.id)
      rooms.set(roomId, room)
      console.log('room updated', roomId, room)
      io.to(roomId).emit('roomUpdate', room)
    }
  })

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id)
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter(id => id !== socket.id)
        rooms.set(roomId, room)
        console.log('room updated after disconnect', roomId, room)
        io.to(roomId).emit('roomUpdate', room)
      }
    }
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log(`socket server listening on ${PORT}`))
