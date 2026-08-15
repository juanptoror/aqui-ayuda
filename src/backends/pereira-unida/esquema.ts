/**
 * Esquema real de Pereira Unida, descubierto a mano.
 *
 * Este proyecto no expone su OpenAPI con la clave publicable (`/rest/v1/`
 * responde 401 "Secret API key required"), así que las tablas se encontraron
 * probando nombres. La convención es inglés en snake_case, distinta de Ayudas
 * Pereira, que está en español. Por eso este archivo existe: para que esa
 * diferencia se quede aquí y no se filtre al resto de la aplicación.
 *
 * A diferencia de Ayudas Pereira, aquí NO hay permisos por columna: `SELECT *`
 * devuelve 200 en las cuatro tablas y ninguna columna da 42501. Aun así se
 * piden por nombre, para que un cambio de esquema arriba no traiga campos
 * nuevos sin que nadie lo decida.
 */

export const COLUMNAS_REPORTE =
  'id,title,description,category,urgent_level,status,municipality,location_name,lat,lng,contact_phone,created_at,photo_urls,last_confirmed_at,department' as const

export const COLUMNAS_OFERTA =
  'id,full_name,skill,description,phone,municipality,status,created_at,department' as const

export const COLUMNAS_COMENTARIO = 'id,report_id,author_name,content,created_at' as const

export const COLUMNAS_PUNTO_ACOPIO =
  'id,name,address,lat,lng,municipality,department,contact' as const

export interface FilaReporte {
  id: string
  title: string | null
  description: string | null
  category: string | null
  /** Visto en datos: `critico`. */
  urgent_level: string | null
  /** Visto en datos: `buscando`. */
  status: string | null
  municipality: string | null
  location_name: string | null
  lat: number | null
  lng: number | null
  /** Público: esta tabla publica el teléfono de quien pide ayuda. */
  contact_phone: string | null
  created_at: string
  photo_urls: string[] | null
  /** La comunidad confirma que el reporte sigue vigente. */
  last_confirmed_at: string | null
  department: string | null
}

export interface FilaOferta {
  id: string
  full_name: string | null
  /** Una sola habilidad por fila. Visto: `alimentacion`. */
  skill: string | null
  description: string | null
  phone: string | null
  municipality: string | null
  /** Visto: `activa`. */
  status: string | null
  created_at: string
  department: string | null
}

export interface FilaComentario {
  id: string
  report_id: string
  author_name: string | null
  content: string | null
  created_at: string
}

export interface FilaPuntoAcopio {
  id: string
  name: string | null
  address: string | null
  lat: number | null
  lng: number | null
  municipality: string | null
  department: string | null
  contact: string | null
}
