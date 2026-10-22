import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from './src/product'

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    // index.html uses %APP_NAME% etc. so the page title and description follow src/product.ts.
    name: 'brand-html',
    transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP_NAME).replaceAll('%APP_TAGLINE%', APP_TAGLINE).replaceAll('%APP_DESCRIPTION%', APP_DESCRIPTION),
  }],
  server: {
    host: '127.0.0.1',
  },
})
