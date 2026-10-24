import bcrypt from 'bcrypt'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import http from 'http'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto'
import { Server } from 'socket.io'
import { initializeDatabase, pool } from './db.js'

const JWT_SECRET = process.env.JWT_SECRET
const localJwtSecret = 'rps-club-local-development-secret-not-for-production'
if ((!JWT_SECRET && process.env.DATABASE_URL) || (JWT_SECRET && JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters')
}
const signingSecret = JWT_SECRET || localJwtSecret

const app = express()
const server = http.createServer(app)
const clientOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map(origin => origin.trim())
  : '*'
const io = new Server(server, { cors: { origin: clientOrigins } })
const PORT = Number(process.env.PORT || 3000)
const QUICK_REACTIONS = new Set(['👏', '😮', '😂', '👀'])
const CHOICES = new Set(['Rock', 'Paper', 'Scissors'])
const rooms = new Map()
const authorizedRooms = new Map()
const userSockets = new Map()
const challenges = new Map()

app.use(cors({ origin: clientOrigins }))
app.use(express.json({ limit: '16kb' }))
app.get('/healthz', (_req, res) => res.status(200).send('ok'))

class ApiError extends Error {
  constructor(status, message, details = {}) {
    super(message)
    this.status = status
    this.details = details
  }
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

function requireAuth(req, _res, next) {
  const authorization = req.headers.authorization || ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token) return next(new ApiError(401, 'Sign in to continue'))
  jwt.verify(token, signingSecret, (error, payload) => {
    if (error || !payload || typeof payload === 'string' || !payload.sub || !payload.username) {
      return next(new ApiError(401, 'Your session has expired. Please sign in again.'))
    }
    req.user = { id: payload.sub, username: payload.username }
    next()
  })
}

function usernameFrom(body) {
  if (typeof body?.username !== 'string') throw new ApiError(400, 'Enter a username')
  const username = body.username.trim().toLowerCase()
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw new ApiError(400, 'Username must be 3–20 characters using letters, numbers, or underscores')
  }
  return username
}

function passwordFrom(body) {
  if (
    typeof body?.password !== 'string' ||
    body.password.length < 8 ||
    Buffer.byteLength(body.password, 'utf8') > 72
  ) {
    throw new ApiError(400, 'Password must be 8–72 characters')
  }
  return body.password
}

function emailFrom(body) {
  if (typeof body?.email !== 'string') throw new ApiError(400, 'Enter your email address')
  const email = body.email.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'Enter a valid email address')
  }
  return email
}

function verificationHash(code) {
  return createHmac('sha256', signingSecret).update(code).digest('hex')
}

async function sendAccountCode(email, code, purpose) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    if (process.env.NODE_ENV === 'production') {
      throw new ApiError(503, 'Email delivery is not configured. Please try again later.')
    }
    console.info(`[local ${purpose} code] ${email}: code ${code} (expires in 15 minutes)`)
    return 'console'
  }

  const isPasswordReset = purpose === 'password reset'
  const subject = isPasswordReset ? 'Your RPS Club password reset code' : 'Your RPS Club verification code'
  const message = isPasswordReset
    ? 'Use this code to reset your RPS Club password.'
    : 'Use this code to verify your RPS Club email address.'
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD.replace(/\s/g, '') },
  })
  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject,
    text: `${message} Your code is ${code}. It expires in 15 minutes.`,
    html: `<p>${message}</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${code}</p><p>This code expires in 15 minutes. If you did not request this, you can ignore this email.</p>`,
  })
  return 'email'
}

function verificationResponse(res, email, delivery, status = 200) {
  return res.status(status).json({
    verificationRequired: true,
    email,
    developmentCodeInServerLog: delivery === 'console',
    emailDeliveryFailed: delivery === 'failed',
  })
}

async function deliverAccountCode(email, code, purpose) {
  try {
    return await sendAccountCode(email, code, purpose)
  } catch (error) {
    console.error(`Could not send ${purpose} email:`, error)
    return 'failed'
  }
}

function createSession(user) {
  return {
    token:     jwt.sign({ sub: user.id, username: user.username }, signingSecret, { expiresIn: '7d' }),
    user: {
      id: user.id,
      username: user.username,
      email: user.email || null,
      emailVerified: user.email_verified ?? true,
      createdAt: user.created_at || null,
    },
  }
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

app.post('/api/auth/register', authLimiter, asyncRoute(async (req, res) => {
  const username = usernameFrom(req.body)
  const password = passwordFrom(req.body)
  const email = emailFrom(req.body)
  const id = randomUUID()
  const passwordHash = await bcrypt.hash(password, 12)
  const code = String(randomInt(100000, 1000000))
  const codeHash = verificationHash(code)
  try {
    await pool.query(
      `INSERT INTO users (id, username, password_hash, email, email_verified, verification_code_hash, verification_code_expires_at)
       VALUES ($1, $2, $3, $4, false, $5, now() + interval '15 minutes')`,
      [id, username, passwordHash, email, codeHash],
    )
  } catch (error) {
    if (error.code !== '23505') throw error

    const { rows } = await pool.query(
      `SELECT id FROM users
       WHERE email = $1 AND email_verified = false`,
      [email],
    )
    const pendingUser = rows[0]
    if (pendingUser) {
      await pool.query(
        `UPDATE users
         SET verification_code_hash = $2, verification_code_expires_at = now() + interval '15 minutes'
         WHERE id = $1`,
        [pendingUser.id, codeHash],
      )
      const delivery = await deliverAccountCode(email, code, 'verification')
      return verificationResponse(res, email, delivery)
    }
    if (error.constraint?.includes('email')) {
      throw new ApiError(409, 'An account already uses that email address')
    }
    throw new ApiError(409, 'That username is already taken')
  }
  const delivery = await deliverAccountCode(email, code, 'verification')
  verificationResponse(res, email, delivery, 201)
}))

app.post('/api/auth/verify-email', authLimiter, asyncRoute(async (req, res) => {
  const email = emailFrom(req.body)
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, 'Enter the 6-digit code from your email')

  const { rows } = await pool.query(
    `SELECT id, username, email, email_verified, created_at, verification_code_hash
     FROM users
     WHERE email = $1 AND email_verified = false AND verification_code_expires_at > now()`,
    [email],
  )
  const user = rows[0]
  const suppliedHash = Buffer.from(verificationHash(code), 'hex')
  const storedHash = user?.verification_code_hash ? Buffer.from(user.verification_code_hash, 'hex') : Buffer.alloc(32)
  if (!user || storedHash.length !== suppliedHash.length || !timingSafeEqual(storedHash, suppliedHash)) {
    throw new ApiError(400, 'That code is incorrect or expired. Request a new code and try again.')
  }

  await pool.query(
    `UPDATE users
     SET email_verified = true, verification_code_hash = NULL, verification_code_expires_at = NULL
     WHERE id = $1`,
    [user.id],
  )
  user.email_verified = true
  res.json(createSession(user))
}))

app.post('/api/auth/resend-verification', authLimiter, asyncRoute(async (req, res) => {
  const email = emailFrom(req.body)
  const { rows } = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND email_verified = false',
    [email],
  )
  if (!rows[0]) return res.json({ message: 'If the account needs verification, a new code has been sent.' })

  const code = String(randomInt(100000, 1000000))
  await pool.query(
    `UPDATE users
     SET verification_code_hash = $2, verification_code_expires_at = now() + interval '15 minutes'
     WHERE id = $1`,
    [rows[0].id, verificationHash(code)],
  )
  const delivery = await deliverAccountCode(email, code, 'verification')
  res.json({
    message: 'If the account needs verification, a new code has been sent.',
    developmentCodeInServerLog: delivery === 'console',
    emailDeliveryFailed: delivery === 'failed',
  })
}))

app.post('/api/auth/request-password-reset', authLimiter, asyncRoute(async (req, res) => {
  const email = emailFrom(req.body)
  const { rows } = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND email_verified = true',
    [email],
  )
  const user = rows[0]
  if (!user) {
    return res.json({ message: 'If a verified account uses that email, a reset code has been sent.' })
  }

  const code = String(randomInt(100000, 1000000))
  const codeHash = verificationHash(code)
  await pool.query(
    `UPDATE users
     SET password_reset_code_hash = $2, password_reset_code_expires_at = now() + interval '15 minutes'
     WHERE id = $1`,
    [user.id, codeHash],
  )
  const delivery = await deliverAccountCode(email, code, 'password reset')
  if (delivery === 'failed') {
    await pool.query(
      `UPDATE users
       SET password_reset_code_hash = NULL, password_reset_code_expires_at = NULL
       WHERE id = $1 AND password_reset_code_hash = $2`,
      [user.id, codeHash],
    )
    throw new ApiError(503, 'We could not send a reset code right now. Please try again later.')
  }
  res.json({
    message: 'If a verified account uses that email, a reset code has been sent.',
    developmentCodeInServerLog: delivery === 'console',
  })
}))

app.post('/api/auth/reset-password', authLimiter, asyncRoute(async (req, res) => {
  const email = emailFrom(req.body)
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, 'Enter the 6-digit reset code from your email')
  const password = passwordFrom(req.body)
  const suppliedHash = verificationHash(code)
  const { rows } = await pool.query(
    `SELECT id, username, email, email_verified, created_at, password_reset_code_hash
     FROM users
     WHERE email = $1 AND email_verified = true AND password_reset_code_expires_at > now()`,
    [email],
  )
  const user = rows[0]
  const storedHash = user?.password_reset_code_hash
    ? Buffer.from(user.password_reset_code_hash, 'hex')
    : Buffer.alloc(32)
  const suppliedHashBuffer = Buffer.from(suppliedHash, 'hex')
  if (!user || storedHash.length !== suppliedHashBuffer.length || !timingSafeEqual(storedHash, suppliedHashBuffer)) {
    throw new ApiError(400, 'That code is incorrect or expired. Request a new reset code and try again.')
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const { rows: updatedUsers } = await pool.query(
    `UPDATE users
     SET password_hash = $3, password_reset_code_hash = NULL, password_reset_code_expires_at = NULL
     WHERE id = $1 AND password_reset_code_hash = $2 AND password_reset_code_expires_at > now()
     RETURNING id, username, email, email_verified, created_at`,
    [user.id, suppliedHash, passwordHash],
  )
  if (!updatedUsers[0]) {
    throw new ApiError(400, 'That code is incorrect or expired. Request a new reset code and try again.')
  }
  res.json(createSession(updatedUsers[0]))
}))

app.post('/api/auth/login', authLimiter, asyncRoute(async (req, res) => {
  const username = usernameFrom(req.body)
  const password = passwordFrom(req.body)
  const { rows } = await pool.query(
    'SELECT id, username, email, password_hash, email_verified, created_at FROM users WHERE username = $1',
    [username],
  )
  const user = rows[0]
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new ApiError(401, 'Username or password is incorrect')
  }
  if (!user.email_verified) {
    throw new ApiError(403, 'Verify your email address before signing in', {
      verificationRequired: true,
      email: user.email,
    })
  }
  res.json(createSession(user))
}))

app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, username, email, email_verified AS "emailVerified", created_at AS "createdAt" FROM users WHERE id = $1',
    [req.user.id],
  )
  if (!rows[0]) throw new ApiError(401, 'Your account could not be found')
  res.json(rows[0])
}))

app.get('/api/users/search', requireAuth, asyncRoute(async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (query.length < 2) return res.json([])
  const { rows } = await pool.query(
    'SELECT id, username FROM users WHERE id <> $1 AND username ILIKE $2 ORDER BY username LIMIT 15',
    [req.user.id, `%${query}%`],
  )
  res.json(rows)
}))

app.get('/api/friends', requireAuth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.username
     FROM friend_requests f
     JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE f.status = 'accepted' AND (f.requester_id = $1 OR f.addressee_id = $1)
     ORDER BY u.username`,
    [req.user.id],
  )
  res.json(rows.map(friend => ({ ...friend, online: Boolean(userSockets.get(friend.id)?.size) })))
}))

app.get('/api/friends/requests', requireAuth, asyncRoute(async (req, res) => {
  const [incoming, outgoing] = await Promise.all([
    pool.query(
      `SELECT f.id, u.id AS user_id, u.username
       FROM friend_requests f JOIN users u ON u.id = f.requester_id
       WHERE f.addressee_id = $1 AND f.status = 'pending' ORDER BY f.created_at DESC`,
      [req.user.id],
    ),
    pool.query(
      `SELECT f.id, u.id AS user_id, u.username
       FROM friend_requests f JOIN users u ON u.id = f.addressee_id
       WHERE f.requester_id = $1 AND f.status = 'pending' ORDER BY f.created_at DESC`,
      [req.user.id],
    ),
  ])
  const mapRequest = item => ({ id: item.id, user: { id: item.user_id, username: item.username } })
  res.json({ incoming: incoming.rows.map(mapRequest), outgoing: outgoing.rows.map(mapRequest) })
}))

app.post('/api/friends/requests', requireAuth, asyncRoute(async (req, res) => {
  const username = usernameFrom(req.body)
  const targetResult = await pool.query('SELECT id FROM users WHERE username = $1', [username])
  const target = targetResult.rows[0]
  if (!target) throw new ApiError(404, 'Player not found')
  if (target.id === req.user.id) throw new ApiError(400, 'You cannot add yourself')
  const { rows: existing } = await pool.query(
    `SELECT requester_id, addressee_id, status FROM friend_requests
     WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [req.user.id, target.id],
  )
  if (existing.some(item => item.status === 'accepted')) throw new ApiError(409, 'You are already friends')
  if (existing.some(item => item.addressee_id === req.user.id && item.status === 'pending')) {
    throw new ApiError(409, 'This player already sent you a request. Accept it from incoming requests.')
  }
  if (existing.some(item => item.requester_id === req.user.id && item.status === 'pending')) {
    throw new ApiError(409, 'Friend request already sent')
  }
  try {
    await pool.query(
      'INSERT INTO friend_requests (id, requester_id, addressee_id) VALUES ($1, $2, $3)',
      [randomUUID(), req.user.id, target.id],
    )
  } catch (error) {
    if (error.code === '23505') throw new ApiError(409, 'Friend request already sent')
    throw error
  }
  io.to(`user:${target.id}`).emit('friends:update')
  res.status(201).json({ message: 'Friend request sent' })
}))

app.post('/api/friends/requests/:requestId/accept', requireAuth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE friend_requests SET status = 'accepted'
     WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
     RETURNING requester_id`,
    [req.params.requestId, req.user.id],
  )
  if (!rows[0]) throw new ApiError(404, 'Friend request not found or already handled')
  io.to(`user:${rows[0].requester_id}`).emit('friends:update')
  io.to(`user:${req.user.id}`).emit('friends:update')
  res.json({ message: 'Friend added' })
}))

app.delete('/api/friends/:friendId', requireAuth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM friend_requests
     WHERE status = 'accepted' AND
       ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
     RETURNING requester_id, addressee_id`,
    [req.user.id, req.params.friendId],
  )
  if (!rows[0]) throw new ApiError(404, 'Friend not found')
  const otherUserId = rows[0].requester_id === req.user.id ? rows[0].addressee_id : rows[0].requester_id
  io.to(`user:${otherUserId}`).emit('friends:update')
  io.to(`user:${req.user.id}`).emit('friends:update')
  res.json({ message: 'Friend removed' })
}))

app.use((error, _req, res, _next) => {
  if (error instanceof ApiError) return res.status(error.status).json({ message: error.message, ...error.details })
  console.error('Request failed:', error)
  res.status(500).json({ message: 'Something went wrong. Please try again.' })
})

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token
  if (typeof token !== 'string') return next(new Error('Authentication required'))
  try {
    const payload = jwt.verify(token, signingSecret)
    if (typeof payload === 'string' || !payload.sub) return next(new Error('Invalid session'))
    const { rows } = await pool.query('SELECT id, username FROM users WHERE id = $1', [payload.sub])
    if (!rows[0]) return next(new Error('Account not found'))
    socket.data.user = rows[0]
    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return next(new Error('Session expired'))
    }
    next(error)
  }
})

async function emitPresence(userId, online) {
  const { rows } = await pool.query(
    `SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS friend_id
     FROM friend_requests
     WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)`,
    [userId],
  )
  const friendRooms = rows.map(row => `user:${row.friend_id}`)
  if (friendRooms.length) io.to(friendRooms).emit('presence:update', { userId, online })
}

function clearRoomTimer(room) {
  if (room.timeoutId) clearTimeout(room.timeoutId)
  room.timeoutId = null
}

function cancelPendingRound(room, roomId) {
  clearRoomTimer(room)
  if (Object.keys(room.choices).length) {
    room.choices = {}
    io.to(roomId).emit('roundCancelled')
  }
}

function revealChoices(room, roomId) {
  clearRoomTimer(room)
  io.to(roomId).emit('choicesRevealed', room.choices)
  room.choices = {}
}

function leaveGameRoom(socket, roomId) {
  socket.leave(roomId)
  const room = rooms.get(roomId)
  if (!room) return
  cancelPendingRound(room, roomId)
  room.players = room.players.filter(id => id !== socket.id)
  delete room.names[socket.id]
  room.rematchReady = room.rematchReady.filter(id => id !== socket.id)
  io.to(roomId).emit('roomUpdate', { players: room.players, names: room.names })
  io.to(roomId).emit('rematchUpdate', room.rematchReady)
  if (!room.players.length) rooms.delete(roomId)
}

io.on('connection', (socket) => {
  const user = socket.data.user
  const ownRoom = `user:${user.id}`
  socket.join(ownRoom)
  const sockets = userSockets.get(user.id) || new Set()
  const previouslyOffline = sockets.size === 0
  sockets.add(socket.id)
  userSockets.set(user.id, sockets)
  if (previouslyOffline) {
    void emitPresence(user.id, true).catch(error => console.error('Could not publish online status:', error))
  }

  socket.on('joinRoom', ({ roomId } = {}) => {
    const playersAllowed = authorizedRooms.get(roomId)
    if (typeof roomId !== 'string' || !playersAllowed?.has(user.id)) return
    let room = rooms.get(roomId) || { players: [], names: {}, choices: {}, rematchReady: [] }
    if (room.players.includes(socket.id)) {
      socket.emit('roomUpdate', { players: room.players, names: room.names })
      return
    }
    if (room.players.length >= 2 || room.players.some(id => io.sockets.sockets.get(id)?.data.user.id === user.id)) {
      socket.emit('roomFull')
      return
    }
    room.players.push(socket.id)
    room.names[socket.id] = user.username
    rooms.set(roomId, room)
    socket.data.roomId = roomId
    socket.join(roomId)
    io.to(roomId).emit('roomUpdate', { players: room.players, names: room.names })
  })

  socket.on('quickReaction', ({ roomId, reaction } = {}) => {
    const room = rooms.get(roomId)
    if (!room || !room.players.includes(socket.id) || !QUICK_REACTIONS.has(reaction)) return
    if (Date.now() - (socket.data.lastReactionAt || 0) < 800) return
    socket.data.lastReactionAt = Date.now()
    socket.to(roomId).emit('opponentReaction', { reaction })
  })

  socket.on('playerChoice', ({ roomId, choice } = {}) => {
    const room = rooms.get(roomId)
    if (!room || !room.players.includes(socket.id) || !CHOICES.has(choice) || room.choices[socket.id]) return
    room.choices[socket.id] = choice
    const otherId = room.players.find(id => id !== socket.id)
    const duration = 8000
    if (otherId) {
      io.to(roomId).emit('opponentMadeChoice', socket.id)
      io.to(roomId).emit('startCountdown', { by: socket.id, duration })
      clearRoomTimer(room)
      room.timeoutId = setTimeout(() => {
        if (!room.choices[otherId] && room.choices[socket.id]) {
          const choices = ['Rock', 'Paper', 'Scissors']
          room.choices[otherId] = choices[Math.floor(Math.random() * choices.length)]
        }
        revealChoices(room, roomId)
      }, duration)
    }
    if (Object.keys(room.choices).length === room.players.length) revealChoices(room, roomId)
  })

  socket.on('requestRematch', (roomId) => {
    const room = rooms.get(roomId)
    if (!room || room.players.length !== 2 || !room.players.includes(socket.id)) return
    if (!room.rematchReady.includes(socket.id)) room.rematchReady.push(socket.id)
    io.to(roomId).emit('rematchUpdate', room.rematchReady)
    if (room.rematchReady.length === 2) {
      room.rematchReady = []
      room.choices = {}
      clearRoomTimer(room)
      io.to(roomId).emit('rematchStarted')
    }
  })

  socket.on('leaveRoom', (roomId) => {
    leaveGameRoom(socket, roomId)
    socket.data.roomId = null
  })

  socket.on('friend:challenge', async ({ friendId } = {}, acknowledge = () => {}) => {
    if (typeof friendId !== 'string' || friendId === user.id || !userSockets.get(friendId)?.size) {
      acknowledge({ ok: false, message: 'That friend is not online right now' })
      return
    }
    if ([...challenges.values()].some(item => item.from === user.id && item.to === friendId)) {
      acknowledge({ ok: false, message: 'You already sent this friend a challenge' })
      return
    }
    let rows
    try {
      ({ rows } = await pool.query(
        `SELECT id FROM friend_requests WHERE status = 'accepted' AND
          ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
        [user.id, friendId],
      ))
    } catch (error) {
      console.error('Could not verify friendship for challenge:', error)
      acknowledge({ ok: false, message: 'Could not send the challenge. Please try again.' })
      return
    }
    if (!rows[0]) {
      acknowledge({ ok: false, message: 'You can only challenge an accepted friend' })
      return
    }
    const challengeId = randomUUID()
    const roomId = randomUUID()
    const timeoutId = setTimeout(() => {
      const challenge = challenges.get(challengeId)
      if (!challenge) return
      challenges.delete(challengeId)
      io.to(`user:${challenge.from}`).emit('friend:challenge-expired', { challengeId })
      io.to(`user:${challenge.to}`).emit('friend:challenge-expired', { challengeId })
    }, 60_000)
    challenges.set(challengeId, { from: user.id, fromUsername: user.username, to: friendId, roomId, timeoutId })
    io.to(`user:${friendId}`).emit('friend:challenge', {
      challengeId,
      fromId: user.id,
      fromUsername: user.username,
    })
    acknowledge({ ok: true })
  })

  socket.on('challenge:respond', async ({ challengeId, accept } = {}, acknowledge = () => {}) => {
    const challenge = challenges.get(challengeId)
    if (!challenge || challenge.to !== user.id) {
      acknowledge({ ok: false, message: 'This challenge has expired' })
      return
    }
    clearTimeout(challenge.timeoutId)
    challenges.delete(challengeId)
    if (!accept) {
      io.to(`user:${challenge.from}`).emit('friend:challenge-declined', { challengeId })
      acknowledge({ ok: true })
      return
    }
    if (!userSockets.get(challenge.from)?.size) {
      acknowledge({ ok: false, message: 'Your friend is no longer online' })
      return
    }
    authorizedRooms.set(challenge.roomId, new Set([challenge.from, challenge.to]))
    io.to(`user:${challenge.from}`).emit('friend:challenge-accepted', {
      roomId: challenge.roomId,
      opponent: user.username,
    })
    acknowledge({ ok: true, roomId: challenge.roomId, opponent: challenge.fromUsername })
  })

  socket.on('disconnect', () => {
    const connectedSockets = userSockets.get(user.id)
    connectedSockets?.delete(socket.id)
    if (!connectedSockets?.size) {
      userSockets.delete(user.id)
      void emitPresence(user.id, false).catch(error => console.error('Could not publish offline status:', error))
    }
    for (const [challengeId, challenge] of challenges) {
      if (challenge.from === user.id || challenge.to === user.id) {
        clearTimeout(challenge.timeoutId)
        challenges.delete(challengeId)
        const otherId = challenge.from === user.id ? challenge.to : challenge.from
        io.to(`user:${otherId}`).emit('friend:challenge-expired', { challengeId })
      }
    }
    if (socket.data.roomId) leaveGameRoom(socket, socket.data.roomId)
  })
})

async function start() {
  console.log('Initializing account database')
  await initializeDatabase()
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`socket server listening on ${PORT}`)
    console.log(process.env.DATABASE_URL ? 'Using configured PostgreSQL database' : 'Using local embedded database')
  })
}

start().catch(error => {
  console.error('Could not start the game server:', error)
  process.exitCode = 1
})
