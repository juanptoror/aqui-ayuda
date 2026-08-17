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

/* --------------------------- Daños de servicios ---------------------------- */

/**
 * `service_outages`: postes, energía, agua, gas e internet.
 *
 * Es la quinta tabla de esta fuente y la más reciente. No se descubrió probando
 * nombres como las otras: su API pública documenta el recurso `/servicios`, y de
 * ahí salió el nombre a buscar. Las doce columnas de abajo están comprobadas una
 * a una contra PostgREST y coinciden **exactamente** con lo que devuelve esa API
 * —ni una de más, ni una de menos—, así que la tabla y el endpoint son la misma
 * cosa vista de dos maneras.
 *
 * Lo que su API compone al vuelo y aquí NO existe como columna: `service_label`,
 * `severity_label`, `status_label` y `maps_url`. Las etiquetas se componen en
 * `index.ts`; el enlace al mapa ya lo pone `ComoLlegar` a partir de la
 * coordenada, que es más útil que una URL fija de Google.
 *
 * **Hoy tiene cero filas.** No es un fallo de la consulta: la tabla existe,
 * responde 200 y devuelve la lista vacía, igual que `collection_points`. Desde
 * fuera no se puede distinguir "vacía" de "RLS la esconde entera", así que se
 * lee lo que se ve y la pantalla no promete nada que no haya llegado.
 */
export const COLUMNAS_SERVICIO =
  'id,service,severity,description,address,municipality,department,lat,lng,photo_urls,status,created_at' as const

/** Qué servicio falló. Enumerado por su API. */
export type ServicioPublico = 'energia' | 'poste' | 'agua' | 'gas' | 'internet'

/**
 * Severidad, y ojo con leerla como un nivel de riesgo: solo la primera lo es.
 *
 * Su propia documentación las define así: `peligro_critico` = cable vivo o poste
 * cayéndose; `corte_sector` = barrio sin servicio; `falla_puntual` = acometida
 * individual. Solo la primera habla de peligro; las otras dos dicen **a cuánta
 * gente afecta**, que es otra pregunta. Traducir "todo un barrio sin agua" a
 * "riesgo medio" sería inventarse una alarma, y por eso en `index.ts` únicamente
 * `peligro_critico` se convierte en gravedad.
 */
export type SeveridadServicio = 'peligro_critico' | 'corte_sector' | 'falla_puntual'

/** `abierto` en su API es todo lo que no está `resuelto`. */
export type EstadoServicio = 'reportado' | 'en_atencion' | 'resuelto'

export interface FilaServicio {
  id: string
  service: ServicioPublico | string | null
  severity: SeveridadServicio | string | null
  description: string | null
  /** Dirección de calle. Es un dato propio: la otra fuente de daños no lo tiene. */
  address: string | null
  municipality: string | null
  department: string | null
  lat: number | null
  lng: number | null
  photo_urls: string[] | null
  status: EstadoServicio | string | null
  created_at: string
}

/**
 * Arriendos publicados por la comunidad.
 *
 * Es la tabla mejor cuidada de las cuatro de esta fuente: 82 filas con 77
 * coordenadas distintas y reales, precio en 69 y un estado que de verdad
 * cambia (18 ya están ocupadas). Nada que ver con el otro listado de vivienda,
 * cuyas coordenadas son un valor por defecto.
 */
export const COLUMNAS_RENTAL =
  'id,municipality,department,neighborhood,address,property_type,furnished,contact,monthly_rent,photo_urls,lat,lng,submitted_at,status,created_at' as const

export interface FilaRental {
  id: string
  municipality: string | null
  department: string | null
  neighborhood: string | null
  address: string | null
  /** Apartamento, Casa, Apartaestudio, Habitación, Local, Otro. */
  property_type: string | null
  furnished: boolean | null
  contact: string | null
  monthly_rent: number | null
  photo_urls: string[] | null
  lat: number | null
  lng: number | null
  submitted_at: string | null
  /** `disponible` (64) u `ocupada` (18). Las ocupadas no se listan. */
  status: string | null
  created_at: string
}
