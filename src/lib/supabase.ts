import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Falta de configuración: se detecta al arrancar en vez de fallar dentro de
 * cada consulta con un error opaco. La UI lo muestra como estado explicado.
 */
export const supabaseConfigError: string | null =
  !url || !anonKey
    ? 'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el entorno.'
    : null

export const supabase: SupabaseClient = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'ac.auth',
  },
  global: {
    headers: { 'x-application-name': 'ayudas-colombia-web' },
  },
})
