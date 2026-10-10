import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The build manifest (spec 038 T004, FR-02): the deterministic
  // chunk-class assertion reads `dist/.vite/manifest.json` to prove that
  // customer-page chunks import no staff/admin-only module ids and vice
  // versa. Manifest emission has NO effect on the bundle itself (metadata
  // only, written beside dist/assets).
  build: {
    manifest: true,
  },
})
