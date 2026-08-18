import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this repo under /ResidentialPropertyPriceRegister/,
  // not the domain root, so every asset reference needs this prefix.
  base: '/ResidentialPropertyPriceRegister/',
  plugins: [react()],
})
