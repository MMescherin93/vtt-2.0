import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** @vtt/shared собирается вместе с приложением (в нём TS-исходники) */
const sharedSource = { exclude: ['@vtt/shared'] }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(sharedSource)]
  },
  preload: {
    plugins: [externalizeDepsPlugin(sharedSource)]
  },
  renderer: {
    plugins: [react(), tailwindcss()]
  }
})
