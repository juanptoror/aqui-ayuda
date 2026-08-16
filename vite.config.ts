import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import manejarReportes from './api/reportes'

/**
 * La función de `/api` también en desarrollo.
 *
 * En producción la ejecuta Vercel; aquí la monta este plugin sobre el mismo
 * fichero, para que lo que se prueba en localhost sea exactamente el código que
 * va a correr desplegado y no una imitación.
 *
 * `loadEnv(..., '')` con prefijo vacío lee TODAS las variables del `.env`,
 * también las que no empiezan por `VITE_`. Eso pasa aquí, en el proceso de
 * Node, y solo para pasar la clave a `process.env`: nunca entra en `define` ni
 * en el bundle, que es justo lo que hay que evitar con una clave de escritura.
 */
function apiEnDesarrollo(modo: string): Plugin {
  return {
    name: 'api-en-desarrollo',
    apply: 'serve',
    configureServer(servidor) {
      const entorno = loadEnv(modo, process.cwd(), '')
      if (entorno.PEREIRA_RESPONDE_API_KEY) {
        process.env.PEREIRA_RESPONDE_API_KEY = entorno.PEREIRA_RESPONDE_API_KEY
      }
      servidor.middlewares.use('/api/reportes', (req, res) => {
        void manejarReportes(req, res)
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), apiEnDesarrollo(mode)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
  },
  preview: {
    port: 4180,
    strictPort: true,
  },
  build: {
    // El objetivo es una web app usable con red inestable: partimos el bundle
    // para que el shell pinte antes de que llegue el cliente de datos.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          // Leaflet solo lo pide quien abre un mapa, y llega después de que la
          // pantalla ya esté pintada con el esquema. Chunk aparte.
          leaflet: ['leaflet'],
        },
      },
    },
  },
}))
