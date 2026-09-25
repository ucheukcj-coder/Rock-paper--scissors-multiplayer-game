import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/Rock-paper--scissors-multiplayer-game/',
  plugins: [react()],
})