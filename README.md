# RPS Club

Rock Paper Scissors with player accounts, friend requests, online presence, and friend challenges. The client uses React; the existing Express/Socket.IO server provides the API and live game sessions, with PostgreSQL for accounts and friendships.

## Deploy

GitHub Pages hosts the frontend. Render deploys the existing Express/Socket.IO server and provisions PostgreSQL using `render.yaml`.

1. Create a Render Blueprint instance from this repository and allow it to create the web service and PostgreSQL database.
2. In GitHub, open **Settings > Secrets and variables > Actions > Variables** and set `VITE_SOCKET_URL` to the deployed server's public HTTPS URL.
3. Rerun **Deploy React app to GitHub Pages** or push a commit.

The workflow validates that `VITE_SOCKET_URL` is HTTPS. Set Render's `CLIENT_ORIGIN` to the GitHub Pages origin if the site is hosted elsewhere. Free Render services can take a short time to wake after inactivity, and free database plans may have availability or retention limits; use an appropriate paid database plan for long-lived production accounts.

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

`DATABASE_URL` selects PostgreSQL; if it is unset, local embedded storage is used during development. Production requires `DATABASE_URL` and exits with a clear configuration error rather than starting the memory-intensive local database. Render deployments use the PostgreSQL database configured in `render.yaml`. The local-only signing key must not be used in a deployed environment.

When SMTP is not configured, local verification codes are printed in the server terminal; they are not emailed. To send through Gmail, enable 2-Step Verification on your Google account, create a Google App Password, and copy `server/.env.example` to `server/.env`. Fill in your Gmail address and App Password:

Use the App Password, not your regular Gmail password. Restart the server after changing `server/.env`. For a hosted deployment, set the same variables in the service's environment settings and redeploy; the Render Blueprint declares the SMTP variables but does not provide their values. In production, `NODE_ENV=production` prevents local code logging when mail settings are missing. New accounts must verify their email before signing in; an unverified account can return to the code screen from sign-in and request another code. Usernames and email addresses are unique. Set `LOCAL_DATABASE_PATH` to use a different local embedded database directory.

Passwords are hashed before storage. Never reuse a real password in development or commit environment files containing secrets.
