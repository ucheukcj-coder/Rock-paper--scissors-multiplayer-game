# multiplayer-clone

This is a copy of the Rock Paper Scissors demo with a minimal Socket.io server scaffold.

Quick start:

1. Install client deps:

```bash
cd multiplayer-clone
npm install
```

2. Install server deps and start server:

```bash
cd server
npm install
node index.js
```

3. Start the client dev server:

```bash
cd ..
npm run dev
```

Notes:
- The server is a minimal example for pairing two players into a room. It emits `choicesRevealed` when both players have submitted choices.
- You'll need to integrate the client `socket` events into the UI to enable real multiplayer flows. The client already includes `socket.io-client` in `package.json` and a basic import in `Game.jsx`.
