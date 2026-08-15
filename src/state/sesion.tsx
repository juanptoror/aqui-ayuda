import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Acceso por código de un solo uso enviado al correo.
 *
 * Es el único proveedor habilitado en el proyecto (`email: true`, resto en
 * false, `anonymous_users: false`). Se usa el código de 6 dígitos en vez del
 * enlace mágico porque el enlace depende de que el origen esté en la lista de
 * "Redirect URLs" de Supabase, y falla en desarrollo o en cualquier despliegue
 * nuevo. El código funciona desde cualquier origen.
 *
 * Qué desbloquea: la columna `centros.telefono`, restringida al rol `anon` por
 * un GRANT por columnas. Todo lo demás se ve sin entrar.
 */

interface Sesion {
  sesion: Session | null
  /** null mientras se restaura la sesión guardada; evita parpadeos de UI. */
  cargando: boolean
  correo: string | null
  enviarCodigo: (correo: string) => Promise<void>
  verificarCodigo: (correo: string, codigo: string) => Promise<void>
  salir: () => Promise<void>
}

const Ctx = createContext<Sesion | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true

    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return
      setSesion(data.session)
      setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSesion(s)
      setCargando(false)
    })

    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const enviarCodigo = useCallback(async (correo: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: correo.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) throw new Error(traducirError(error.message))
  }, [])

  const verificarCodigo = useCallback(async (correo: string, codigo: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email: correo.trim(),
      token: codigo.trim(),
      type: 'email',
    })
    if (error) throw new Error(traducirError(error.message))
  }, [])

  const salir = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const valor = useMemo(
    () => ({
      sesion,
      cargando,
      correo: sesion?.user?.email ?? null,
      enviarCodigo,
      verificarCodigo,
      salir,
    }),
    [sesion, cargando, enviarCodigo, verificarCodigo, salir],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useSesion(): Sesion {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSesion debe usarse dentro de ProveedorSesion')
  return ctx
}

/** Los mensajes de GoTrue llegan en inglés; aquí se explican en español. */
function traducirError(mensaje: string): string {
  const m = mensaje.toLowerCase()
  if (m.includes('invalid') && m.includes('token')) {
    return 'El código no es válido o ya caducó. Pide uno nuevo.'
  }
  if (m.includes('expired')) return 'El código caducó. Pide uno nuevo.'
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.'
  }
  if (m.includes('invalid email') || m.includes('unable to validate email')) {
    return 'Ese correo no parece válido. Revísalo.'
  }
  if (m.includes('signups not allowed') || m.includes('disabled')) {
    return 'El registro está deshabilitado en el servidor.'
  }
  return mensaje
}
