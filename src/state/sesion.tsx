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
import { clienteAP } from '@/backends/ayudas-pereira/cliente'
import { cerrarSesion, enviarCodigo, verificarCodigo } from '@/backends/ayudas-pereira'

/**
 * Sesión de la app.
 *
 * Hoy solo un backend gestiona identidad (Ayudas Pereira, con código al
 * correo), así que este proveedor delega en él en vez de inventar una capa de
 * abstracción para un único caso. Si un segundo backend trae su propia sesión,
 * lo que cambia es este fichero, no las pantallas.
 *
 * Los errores llegan ya traducidos desde el backend: aquí no se interpreta
 * ningún código.
 */

interface Sesion {
  sesion: Session | null
  /** true mientras se restaura la sesión guardada; evita parpadeos de UI. */
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

    clienteAP.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!vivo) return
      setSesion(data.session)
      setCargando(false)
    })

    const { data: sub } = clienteAP.auth.onAuthStateChange(
      (_evento: string, s: Session | null) => {
        setSesion(s)
        setCargando(false)
      },
    )

    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const salir = useCallback(async () => {
    await cerrarSesion()
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
    [sesion, cargando, salir],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useSesion(): Sesion {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSesion debe usarse dentro de ProveedorSesion')
  return ctx
}
