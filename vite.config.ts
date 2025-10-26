import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // 👇 explizit auf Root setzen — vermeidet falsche Pfadauflösungen bei Vercel
  base: '/',

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  plugins: [react()],

  // 👇 optional, aber nützlich bei Caching-Problemen
  build: {
    rollupOptions: {
      output: {
        // sorgt dafür, dass CSS immer eigene Dateien bekommt
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
})
