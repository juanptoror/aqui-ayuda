import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { supabase, supabaseConfigError } from '@/lib/supabase'
import {
  COLUMNAS_CENTRO_PUBLICAS,
  type Centro,
  type Ciudad,
  type ItemInventario,
  type Necesidad,
} from '@/types'

/** Código de PostgREST para "permission denied". */
const SIN_PERMISO = '42501'

export class ErrorPermiso extends Error {
  constructor(public tabla: string) {
    super(`Sin permiso de lectura sobre "${tabla}".`)
    this.name = 'ErrorPermiso'
  }
}

function comprobarConfig() {
  if (supabaseConfigError) throw new Error(supabaseConfigError)
}

/**
 * Reintentar un 42501 es inútil: el permiso no va a aparecer solo, y cada
 * reintento deja la pantalla en "cargando" más tiempo. Los fallos de red sí
 * se reintentan, que son los que suelen resolverse.
 */
function reintentar(intentos: number, error: Error): boolean {
  if (error instanceof ErrorPermiso) return false
  return intentos < 2
}

const OPCIONES_BASE = {
  staleTime: 60_000,
  gcTime: 10 * 60_000,
  retry: reintentar,
  refetchOnWindowFocus: false,
} as const

/** Ciudades listables: activas y no fusionadas en otra. */
export function useCiudades(): UseQueryResult<Ciudad[]> {
  return useQuery({
    queryKey: ['ciudades'],
    ...OPCIONES_BASE,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      comprobarConfig()
      const { data, error } = await supabase
        .from('ciudades')
        .select('id,nombre,departamento,slug,activa,fusionada_en,created_at')
        .order('nombre')

      if (error) {
        if (error.code === SIN_PERMISO) throw new ErrorPermiso('ciudades')
        throw new Error(error.message)
      }
      return (data ?? []) as Ciudad[]
    },
  })
}

/**
 * Todos los centros de una vez (son decenas, no miles) y el filtrado se hace
 * en cliente: así el orden por cercanía funciona a nivel nacional sin una
 * consulta por ciudad, y cambiar de municipio es instantáneo.
 *
 * `conSesion` añade `telefono` a la lista de columnas. NUNCA se pide sin
 * sesión: esa columna está denegada para `anon` y, al ir en el mismo SELECT,
 * tumbaría la consulta entera con 42501 y dejaría la pantalla sin centros.
 */
export function useCentros(conSesion: boolean): UseQueryResult<Centro[]> {
  return useQuery({
    queryKey: ['centros', conSesion],
    ...OPCIONES_BASE,
    queryFn: async () => {
      comprobarConfig()
      const columnas = conSesion
        ? [...COLUMNAS_CENTRO_PUBLICAS, 'telefono']
        : [...COLUMNAS_CENTRO_PUBLICAS]

      const { data, error } = await supabase
        .from('centros')
        .select(columnas.join(','))
        .eq('activo', true)

      if (error) {
        if (error.code === SIN_PERMISO) throw new ErrorPermiso('centros')
        throw new Error(error.message)
      }
      return (data ?? []) as unknown as Centro[]
    },
  })
}

export function useNecesidades(): UseQueryResult<Necesidad[]> {
  return useQuery({
    queryKey: ['necesidades'],
    ...OPCIONES_BASE,
    queryFn: async () => {
      comprobarConfig()
      const { data, error } = await supabase
        .from('necesidades')
        .select('id,centro_id,categoria,descripcion,prioridad,estado,created_at')
        .order('created_at', { ascending: false })

      if (error) {
        if (error.code === SIN_PERMISO) throw new ErrorPermiso('necesidades')
        throw new Error(error.message)
      }
      return (data ?? []) as Necesidad[]
    },
  })
}

export function useInventario(): UseQueryResult<ItemInventario[]> {
  return useQuery({
    queryKey: ['inventario'],
    ...OPCIONES_BASE,
    queryFn: async () => {
      comprobarConfig()
      const { data, error } = await supabase
        .from('inventario')
        .select('id,centro_id,categoria,cantidad,unidad,updated_at')

      if (error) {
        if (error.code === SIN_PERMISO) throw new ErrorPermiso('inventario')
        throw new Error(error.message)
      }
      return (data ?? []) as ItemInventario[]
    },
  })
}
