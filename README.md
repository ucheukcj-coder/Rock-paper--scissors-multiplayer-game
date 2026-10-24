# RPS Club

Rock Paper Scissors with player accounts, friend requests, online presence, and friend challenges. The client uses React; the existing Express/Socket.IO server provides the API and live game sessions, with PostgreSQL for accounts and friendships.

## Deploy

GitHub Pages hosts the frontend. Render runs the Express/Socket.IO server and PostgreSQL database together using the repository's `render.yaml` Blueprint.

1. In Render, create a Blueprint from this GitHub repository, or open the existing Blueprint and select **Manual sync**.
2. Review the proposed changes. The Blueprint creates the `multiplayer-clone-db` PostgreSQL database and links its connection string to the `multiplayer-clone-socket` service as `DATABASE_URL`. Approve the sync to apply it.
3. Wait for the database status to become **Available** and the web service's latest deploy to show **Live** or **Deploy succeeded**.
4. The Blueprint sets `NODE_ENV`, `JWT_SECRET`, and `CLIENT_ORIGIN`. Configure the SMTP variables from `server/.env.example` in the web service's **Environment** settings if they are not already set; keep these credentials private. SMTP is used for both new-account verification and password reset codes.
5. GitHub Pages is configured to use the Render URL `https://multiplayer-clone-socket.onrender.com`. If the server's public URL changes, set `VITE_SOCKET_URL` in GitHub **Settings > Secrets and variables > Actions > Variables** to its public HTTPS URL, then rerun **Deploy React app to GitHub Pages**.

The current Render free PostgreSQL database is temporary and displays its expiration date in the dashboard; upgrade it before that date to retain account data. Existing accounts stored in a different database are not copied automatically.

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
