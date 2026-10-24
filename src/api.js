export const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? 'http://localhost:3000' : '')
).replace(/\/$/, '')

export async function apiRequest(path, { token, body, method = 'GET' } = {}) {
  if (!API_BASE) throw new Error('The game server URL is not configured')
  let response
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Can't reach the game server at ${API_BASE}. Check the server deployment and its CLIENT_ORIGIN setting.`)
    }
    throw error
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.message || 'Request failed. Please try again.')
    error.status = response.status
    error.details = result
    throw error
  }
  return result
}
