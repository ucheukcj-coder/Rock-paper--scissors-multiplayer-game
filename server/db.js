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
      firebase_uid varchar(128),
      verification_code_hash varchar(64),
      verification_code_expires_at timestamptz,
      password_reset_code_hash varchar(64),
      password_reset_code_expires_at timestamptz,
      total_wins integer NOT NULL DEFAULT 0,
      matches_played integer NOT NULL DEFAULT 0,
      coins integer NOT NULL DEFAULT 200,
      is_premium boolean NOT NULL DEFAULT false,
      premium_since timestamptz,
      equipped_gif_id varchar(80),
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9_]{3,20}$')
    )`,
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS email varchar(254)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT true',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid varchar(128)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_hash varchar(64)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at timestamptz',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_code_hash varchar(64)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_code_expires_at timestamptz',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS total_wins integer NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS matches_played integer NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 200',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_since timestamptz',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_gif_id varchar(80)',
    'CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email) WHERE email IS NOT NULL',
    'CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_unique_idx ON users(firebase_uid) WHERE firebase_uid IS NOT NULL',
    `CREATE TABLE IF NOT EXISTS gif_catalog (
      id varchar(80) PRIMARY KEY,
      name varchar(80) NOT NULL,
      category varchar(40) NOT NULL,
      item_type varchar(20) NOT NULL DEFAULT 'gif',
      price integer NOT NULL DEFAULT 0,
      premium boolean NOT NULL DEFAULT false,
      image_url text NOT NULL,
      preview_url text,
      tags text[] NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS user_gif_inventory (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gif_id varchar(80) NOT NULL REFERENCES gif_catalog(id) ON DELETE CASCADE,
      source varchar(16) NOT NULL DEFAULT 'shop',
      equipped boolean NOT NULL DEFAULT false,
      purchased_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT user_gif_inventory_unique UNIQUE (user_id, gif_id)
    )`,
    'CREATE INDEX IF NOT EXISTS user_gif_inventory_user_idx ON user_gif_inventory(user_id)',
    'CREATE INDEX IF NOT EXISTS user_gif_inventory_gif_idx ON user_gif_inventory(gif_id)',
    `CREATE TABLE IF NOT EXISTS coin_transactions (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      direction varchar(12) NOT NULL CHECK (direction IN ('credit', 'debit')),
      amount integer NOT NULL,
      reason varchar(60) NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    'CREATE INDEX IF NOT EXISTS coin_transactions_user_idx ON coin_transactions(user_id, created_at DESC)',
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
