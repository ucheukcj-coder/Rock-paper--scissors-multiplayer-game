# RPS Club

Rock Paper Scissors with player accounts, friend requests, online presence, and friend challenges. The client uses React; the existing Express/Socket.IO server provides the API and live game sessions, with PostgreSQL for accounts and friendships.

## Deploy

GitHub Pages hosts the frontend. Railway runs the Express/Socket.IO server as one persistent Node service, and its PostgreSQL service stores accounts and friendships.

1. In Railway, create a project from this GitHub repository and add a PostgreSQL service.
2. Add a server service from the same repository. In the service's **Settings**, set its **Root Directory** to `/server`. Railway detects `npm start` from `server/package.json`. Set its health check path to `/healthz`.
3. In the server service's **Variables**, add `NODE_ENV=production`, `CLIENT_ORIGIN=https://ucheukcj-coder.github.io`, and a `JWT_SECRET` with at least 32 random characters. Add `DATABASE_URL` as a reference to the PostgreSQL service's `DATABASE_URL`.
4. Add the SMTP variables from `server/.env.example` to the server service if email verification is needed. Keep these credentials private.
5. In **Settings > Networking**, generate a public domain for the Railway server. Copy its HTTPS origin (without a trailing slash).
6. In GitHub, open **Settings > Secrets and variables > Actions > Variables** and set `VITE_API_URL` to that public HTTPS origin.
7. Rerun **Deploy React app to GitHub Pages**. Check both the Railway deployment and the GitHub Actions run.

Keep the Railway server at one replica: active game rooms and presence are held in server memory and are not shared between replicas. Set the `VITE_API_URL` Actions variable before rebuilding the frontend; it takes precedence over the legacy `VITE_SOCKET_URL` setting and the old Render default. Existing accounts in another deployment's database are not copied automatically; leave the old service and database intact until any required data migration is planned.

## Run locally

1. Install the frontend dependencies from the repository root with `npm install`.
2. For quick local testing, no database installation or `.env` file is needed. The server automatically uses a persistent, embedded PostgreSQL-compatible database in `server/.local-db/`.
3. In a terminal, run `npm run start-server` from the repository root. The server creates its account and friend tables when it starts.
4. In another terminal, run `npm run dev` from the repository root. Open the local Vite address (usually `http://localhost:5173`) to create accounts and test the app.

For testing against a PostgreSQL server instead, create `server/.env` with:

   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/multiplayer_clone
   JWT_SECRET=replace-with-a-random-secret-at-least-32-characters-long
   CLIENT_ORIGIN=http://localhost:5173
   ```

`DATABASE_URL` selects PostgreSQL; if it is unset, local embedded storage is used during development. Production requires `DATABASE_URL` and exits with a clear configuration error rather than starting the memory-intensive local database. The local-only signing key must not be used in a deployed environment.

When SMTP is not configured, local verification codes are printed in the server terminal; they are not emailed. To send through Gmail, enable 2-Step Verification on your Google account, create a Google App Password, and copy `server/.env.example` to `server/.env`. Fill in your Gmail address and App Password:

Use the App Password, not your regular Gmail password. Restart the server after changing `server/.env`. For a hosted deployment, set the same variables in the service's environment settings and redeploy. In production, `NODE_ENV=production` prevents local code logging when mail settings are missing. New accounts must verify their email before signing in; an unverified account can return to the code screen from sign-in and request another code. Usernames and email addresses are unique. Set `LOCAL_DATABASE_PATH` to use a different local embedded database directory.

Passwords are hashed before storage. Never reuse a real password in development or commit environment files containing secrets.
