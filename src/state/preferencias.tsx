import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Coordenada } from '@/types'

type Tema = 'light' | 'dark'

const CLAVE_TEMA = 'ac.theme'
const CLAVE_UBICACION = 'ac.ubicacion'
const CLAVE_CIUDAD = 'ac.ciudad'

interface Preferencias {
  tema: Tema
  alternarTema: () => void

  /** Coordenada del usuario, del GPS o deducida de la ciudad que eligió. */
  ubicacion: Coordenada | null
  fijarUbicacion: (c: Coordenada | null) => void

  /** Última ciudad elegida: evita volver a preguntar en cada visita. */
  ciudadGuardada: string | null
  fijarCiudadGuardada: (slug: string | null) => void
}

const Ctx = createContext<Preferencias | null>(null)

function leerTemaInicial(): Tema {
  if (typeof document === 'undefined') return 'light'
  const actual = document.documentElement.getAttribute('data-theme')
  return actual === 'dark' ? 'dark' : 'light'
}

function leerJSON<T>(clave: string): T | null {
  try {
    const crudo = localStorage.getItem(clave)
    return crudo ? (JSON.parse(crudo) as T) : null
  } catch {
    return null
  }
}

export function ProveedorPreferencias({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(leerTemaInicial)
  const [ubicacion, setUbicacion] = useState<Coordenada | null>(() =>
    leerJSON<Coordenada>(CLAVE_UBICACION),
  )
  const [ciudadGuardada, setCiudadGuardada] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CLAVE_CIUDAD)
    } catch {
      return null
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema)
    try {
      localStorage.setItem(CLAVE_TEMA, tema)
    } catch {
      /* almacenamiento no disponible (modo privado): el tema vive en memoria */
    }
  }, [tema])

  const alternarTema = useCallback(() => {
    setTema((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const fijarUbicacion = useCallback((c: Coordenada | null) => {
    setUbicacion(c)
    try {
      if (c) localStorage.setItem(CLAVE_UBICACION, JSON.stringify(c))
      else localStorage.removeItem(CLAVE_UBICACION)
    } catch {
      /* sin persistencia: la sesión actual sigue funcionando */
    }
  }, [])

  const fijarCiudadGuardada = useCallback((slug: string | null) => {
    setCiudadGuardada(slug)
    try {
      if (slug) localStorage.setItem(CLAVE_CIUDAD, slug)
      else localStorage.removeItem(CLAVE_CIUDAD)
    } catch {
      /* sin persistencia */
    }
  }, [])

  const valor = useMemo(
    () => ({
      tema,
      alternarTema,
      ubicacion,
      fijarUbicacion,
      ciudadGuardada,
      fijarCiudadGuardada,
    }),
    [tema, alternarTema, ubicacion, fijarUbicacion, ciudadGuardada, fijarCiudadGuardada],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function usePreferencias(): Preferencias {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePreferencias debe usarse dentro de ProveedorPreferencias')
  return ctx
}
