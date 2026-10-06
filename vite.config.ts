import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Never inject provider secrets into client bundles. APIs read server env at runtime.
export default defineConfig({ plugins: [react()] })
