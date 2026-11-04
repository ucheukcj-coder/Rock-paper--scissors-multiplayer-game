# Firebase Authentication setup

This project uses Firebase Authentication for Google and email/password sign-in. The Node/Socket.IO server still uses PostgreSQL for unique player usernames, friends, and game-related account data.

## 1. Enable providers in Firebase

1. Open Firebase Console and select the project used by `src/firebase.js` (`my-rps-app-34895`).
2. Open **Authentication → Sign-in method**.
3. Enable **Email/Password** and **Google**.
4. Under **Authentication → Settings → Authorized domains**, make sure these are listed:
   - `localhost` (local testing)
   - `ucheukcj-coder.github.io` (the current GitHub Pages site)
   - Any custom domain you later connect to the frontend.

## 2. Configure the game server on Render

Add this environment variable to the Render web service that runs `server/index.js`:

- `FIREBASE_WEB_API_KEY` = the `apiKey` value from `src/firebase.js` / Firebase project web app configuration.

The web API key is a Firebase project identifier, not a private service-account credential. Do not put a Firebase service-account private key in the frontend or commit one to Git.

The `render.yaml` file declares this variable as `sync: false`, so it must be entered in the Render dashboard. Save the variable and redeploy/restart the service.

## 3. Test locally

Run the backend and frontend in separate terminals:

```bash
cd server
npm install
npm start
```

```bash
npm install
npm run dev
```

Open the local Vite URL. Register with a username, email, and password. Firebase sends the verification link. Verify the address, then sign in with the same email and password. Google sign-in asks first-time Google users to choose a unique username.

## Authentication flow

- Firebase verifies email/password and Google identities and sends verification/reset emails.
- The frontend sends a Firebase ID token to `/api/auth/firebase-session`.
- The backend validates the token with Firebase Identity Toolkit before issuing the existing game-session JWT.
- PostgreSQL keeps the unique username and the existing friend/game account relationships.

Existing database accounts with the same email can be linked after Firebase confirms that email is verified. Existing multiplayer and Socket.IO routes are not replaced.
