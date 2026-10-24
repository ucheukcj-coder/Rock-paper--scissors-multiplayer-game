import dotenv from 'dotenv'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const { Pool } = pg
const serverDir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(serverDir, '.env') })

let pool
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
} else if (process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL must be configured in production; the embedded database is for local development only')
} else {
  const { PGlite } = await import('@electric-sql/pglite')
  pool = new PGlite(process.env.LOCAL_DATABASE_PATH || path.join(serverDir, '.local-db'))
}

export { pool }

export async function initializeDatabase() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      username varchar(20) NOT NULL UNIQUE,
      password_hash varchar(100) NOT NULL,
      email varchar(254),
      email_verified boolean NOT NULL DEFAULT true,
      verification_code_hash varchar(64),
      verification_code_expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9_]{3,20}$')
    )`,
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS email varchar(254)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT true',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_hash varchar(64)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at timestamptz',
    'CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email) WHERE email IS NOT NULL',
    `CREATE TABLE IF NOT EXISTS friend_requests (
      id uuid PRIMARY KEY,
      requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status varchar(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT friend_request_not_self CHECK (requester_id <> addressee_id),
      CONSTRAINT friend_request_unique_pair UNIQUE (requester_id, addressee_id)
    )`,
    'CREATE INDEX IF NOT EXISTS friend_requests_addressee_status_idx ON friend_requests(addressee_id, status)',
    'CREATE INDEX IF NOT EXISTS friend_requests_requester_status_idx ON friend_requests(requester_id, status)',
  ]
  for (const statement of statements) {
    await pool.query(statement)
  }
}
