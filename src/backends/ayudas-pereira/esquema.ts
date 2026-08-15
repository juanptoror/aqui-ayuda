/**
 * Esquema REAL de Ayudas Pereira, verificado contra la API.
 *
 * Detalle que condiciona todo: `centros` tiene los permisos concedidos POR
 * COLUMNA. `select('*')` devuelve 42501 y deja la pantalla sin ningún centro,
 * aunque la lista explícita de columnas permitidas devuelva 200. Por eso las
 * columnas se declaran aquí y las consultas las usan siempre.
 */

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

/** Columna restringida: solo se pide cuando hay sesión. */
export const COLUMNA_TELEFONO = 'telefono'

export const COLUMNAS_CIUDAD =
  'id,nombre,departamento,slug,activa,fusionada_en,created_at' as const

export const COLUMNAS_NECESIDAD =
  'id,centro_id,categoria,descripcion,prioridad,estado,created_at' as const

export const COLUMNAS_INVENTARIO =
  'id,centro_id,categoria,cantidad,unidad,updated_at' as const

/* --------------------------- Filas tal como llegan ------------------------- */

export interface FilaCiudad {
  id: string
  nombre: string
  departamento: string
  slug: string
  activa: boolean
  fusionada_en: string | null
  created_at: string
}

export interface FilaCentro {
  id: string
  ciudad_id: string | null
  nombre: string | null
  direccion: string | null
  responsable: string | null
  notas: string | null
  activo: boolean
  created_at: string
  lat: number | null
  lng: number | null
  foto: string | null
  abierto: boolean
  telefono?: string | null
}

export interface FilaNecesidad {
  id: string
  centro_id: string
  categoria: string
  descripcion: string | null
  prioridad: string
  estado: string
  created_at: string
}

export interface FilaInventario {
  id: string
  centro_id: string
  categoria: string
  cantidad: number
  unidad: string
  updated_at: string
}

/* ------------------------ Cuerpos de las escrituras ------------------------ */
/* Los nombres son los que espera la API; la traducción desde el dominio la
   hace `mapeadores.ts`, no la UI. */

export interface CuerpoOfrecimiento {
  centro_id: string | null
  ciudad_id: string
  necesidad_id: string | null
  categoria: string
  descripcion: string
  nombre: string
  telefono: string
  direccion_recogida: string
  necesita_transporte: boolean
  estado: 'ofrecido'
}

export interface CuerpoVoluntario {
  ciudad_id: string
  centro_id: string | null
  usuario_id: string
  nombre: string
  telefono: string
  puede_ayudar_en: string
  disponibilidad: string
  notas: string
  disponible: boolean
}

export interface CuerpoVehiculo {
  ciudad_id: string
  usuario_id: string
  nombre: string
  telefono: string
  vehiculo: string
  capacidad: string
  zona: string
  disponible: boolean
}

export interface CuerpoTransporte {
  ciudad_id: string
  origen_id: string
  destino_id: string | null
  destino_texto: string
  carga: string
  vehiculo: string
  conductor: string
  telefono: string
  salida: string | null
  notas: string
  estado: 'programado'
  updated_at: string
}

export interface CuerpoSolicitud {
  centro_id: string
  usuario_id: string
  estado: 'pendiente'
}
