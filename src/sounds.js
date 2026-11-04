// Lightweight WebAudio helpers for short game sound effects
let audioCtx = null
function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioCtx
}

async function tone(frequency = 440, duration = 0.12, type = 'sine', vol = 0.06, timeOffset = 0) {
  const ctx = getCtx()
  // Make sure audio context is running (some browsers block until user gesture)
  try {
    if (ctx.state === 'suspended' && ctx.resume) await ctx.resume()
  } catch (e) {}
  const now = ctx.currentTime + timeOffset
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(frequency, now)
  g.gain.setValueAtTime(vol, now)
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  o.connect(g)
  g.connect(ctx.destination)
  o.start(now)
  o.stop(now + duration + 0.02)
}

export function playClick() {
  try {
    tone(420, 0.06, 'sine', 0.04)
  } catch (e) {
    // ignore
  }
}

export function playWin() {
  try {
    // three ascending tones
    tone(520, 0.12, 'sine', 0.06, 0)
    tone(660, 0.12, 'sine', 0.06, 0.12)
    tone(820, 0.18, 'sine', 0.06, 0.24)
  } catch (e) {}
}

export function playLose() {
  try {
    // descending minor
    tone(420, 0.12, 'sawtooth', 0.06, 0)
    tone(320, 0.14, 'sawtooth', 0.06, 0.12)
    tone(260, 0.18, 'sawtooth', 0.06, 0.28)
  } catch (e) {}
}

export function playDraw() {
  try {
    tone(380, 0.12, 'triangle', 0.05)
  } catch (e) {}
}

export function playNotif() {
  try {
    tone(880, 0.09, 'square', 0.04)
  } catch (e) {}
}

export function resumeAudio() {
  const ctx = getCtx()
  if (ctx && ctx.state === 'suspended' && ctx.resume) return ctx.resume()
  return Promise.resolve()
}
