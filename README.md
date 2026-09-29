# multiplayer-clone

Rock Paper Scissors multiplayer game using React, Socket.IO, and GitHub Pages.

## Deploy multiplayer

GitHub Pages hosts only the frontend. Deploy the Socket.IO server separately:

1. In Render, create a Blueprint instance from this repository. Render reads `render.yaml` and deploys the service in `server/`.
2. Copy the deployed service URL, such as `https://multiplayer-clone-socket.onrender.com`.
3. In the GitHub repository, open **Settings > Secrets and variables > Actions > Variables**, create a repository variable named `VITE_SOCKET_URL`, and set its value to that URL. Do not include a trailing slash.
4. Rerun the **Deploy React app to GitHub Pages** workflow (or push a commit) so the URL is embedded in the frontend build.

The deployment workflow fails if `VITE_SOCKET_URL` is missing or is not HTTPS. Render's free service may take a short time to wake after inactivity; the first connection can be delayed.

## Run locally

Install the frontend dependencies with `npm install`. In one terminal, start the Socket.IO service with `cd server`, `npm install`, then `npm start`. In another terminal, run `npm run dev` from the repository root. During development the client connects to `http://localhost:3000` by default; set `VITE_SOCKET_URL` to override it.
