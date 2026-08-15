/**
 * Tipos derivados del esquema REAL de Supabase, verificado columna a columna
 * contra la API (sonda de 2026-08-15).
 *
 * Detalle importante: `public.centros` tiene los permisos concedidos POR
 * COLUMNA, no sobre la tabla entera. El rol `anon` puede leer todo salvo
 * `telefono`, que solo se sirve a una sesión iniciada. Por eso `select('*')`
 * devuelve 42501 aunque la lista explícita de columnas devuelva 200: hay que
 * pedir siempre columnas concretas.
 */

export type Prioridad = 'urgente' | 'alta' | 'normal'
export type EstadoNecesidad = 'pendiente' | 'cubierta'

/** Las 10 categorías que realmente aparecen en los datos. */
export const CATEGORIAS = [
  'Agua',
  'Alimentos no perecederos',
  'Comidas listas para comer',
  'Aseo e higiene',
  'Pañales y bebés',
  'Medicamentos',
  'Cobijas y colchonetas',
  'Ropa y franelas',
  'Linternas y pilas',
  'Otros',
] as const

export type Categoria = (typeof CATEGORIAS)[number]

/** Columnas de `centros` legibles sin iniciar sesión. */
export const COLUMNAS_CENTRO_PUBLICAS = [
  'id',
  'ciudad_id',
  'nombre',
  'direccion',
  'responsable',
  'notas',
  'activo',
  'created_at',
  'lat',
  'lng',
  'foto',
  'abierto',
] as const

export interface Ciudad {
  id: string
  nombre: string
  departamento: string
  slug: string
  activa: boolean
  /** Si no es null, esta ciudad fue fusionada en otra y no debe listarse. */
  fusionada_en: string | null
  created_at: string
}

export interface Centro {
  id: string
  ciudad_id: string | null
  nombre: string
  direccion: string | null
  /** Persona o entidad a cargo. Sustituye a un campo de contacto formal. */
  responsable: string | null
  /** Texto libre donde los centros escriben horario y qué reciben. */
  notas: string | null
  activo: boolean
  /** Si está recibiendo ahora mismo. Lo más importante antes de desplazarse. */
  abierto: boolean
  lat: number | null
  lng: number | null
  foto: string | null
  created_at: string
  /** Solo llega con sesión iniciada: la columna está restringida para `anon`. */
  telefono?: string | null
}

export interface Necesidad {
  id: string
  centro_id: string
  categoria: string
  descripcion: string | null
  prioridad: Prioridad
  estado: EstadoNecesidad
  created_at: string
}

export interface ItemInventario {
  id: string
  centro_id: string
  categoria: string
  cantidad: number
  unidad: string
  updated_at: string
}

/** Centro enriquecido con lo que se calcula en cliente para la UI. */
export interface CentroVista extends Centro {
  necesidades: Necesidad[]
  inventario: ItemInventario[]
  urgentes: number
  pendientes: number
  /** Kilómetros hasta el usuario, o null si falta alguna coordenada. */
  distanciaKm: number | null
}

export interface Coordenada {
  lat: number
  lng: number
}
