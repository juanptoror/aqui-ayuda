import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente de Ayudas Pereira. Solo se importa dentro de esta carpeta: fuera de
 * `src/backends/ayudas-pereira/` nadie sabe que detrás hay Supabase.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configuracionIncompleta: string | null =
  !url || !anonKey ? 'Falta la configuración de conexión con Ayudas Pereira.' : null

export const clienteAP: SupabaseClient = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'ac.auth',
  },
  global: {
    headers: { 'x-application-name': 'aquiayuda-web' },
  },
})

/** Identificador del usuario en sesión, o null si no ha entrado. */
export async function usuarioActual(): Promise<string | null> {
  const { data } = await clienteAP.auth.getSession()
  return data.session?.user?.id ?? null
}
