/**
 * El contrato de cable de la API pública de Pereira Responde, tal cual lo
 * publica su OpenAPI en https://pereiraresponde.co/api/docs.
 *
 * Estos tipos describen lo que LLEGA, no lo que la aplicación usa. La
 * traducción al vocabulario del dominio vive en `index.ts`, y es ahí donde se
 * corrigen las cosas que el esquema promete y los datos no cumplen.
 */

export const BASE = 'https://pereiraresponde.co'
export const RUTA_REPORTES = '/api/public/v1/reports'

/** La página donde se reporta. No hay endpoint público para publicar. */
export const URL_FUENTE = 'https://pereiraresponde.co'

/**
 * Tope duro del parámetro `limit`. Pedir 501 responde 400, no una lista
 * recortada; y NO pedirlo devuelve 100 por defecto, que a día de hoy ya se
 * queda corto para los 180 reportes visibles. Las dos cosas comprobadas contra
 * la API.
 */
export const LIMITE_MAX = 500

/**
 * Las cuatro clases de reporte.
 *
 * `utility` llegó después que las otras tres —daño o corte en un servicio
 * público: luz, agua, gas, internet, postes— y no es un matiz cosmético: hasta
 * que estuvo en este tipo, un corte de luz entraba por el `?? 'vivienda'` del
 * mapeador y salía en pantalla etiquetado como **edificio dañado**. Un tipo
 * nuevo en una fuente ajena no avisa; lo que avisa es que la etiqueta mienta.
 */
export type TipoReporte = 'housing' | 'road' | 'support' | 'utility'

/**
 * `risk` según el esquema. Ojo: `road`, `support` y `utility` no son niveles de
 * riesgo, son el tipo repetido dentro del campo. Solo `high` y `medium` dicen
 * algo, y solo aparecen en reportes de vivienda.
 */
export type RiesgoReporte = 'high' | 'medium' | 'road' | 'support' | 'utility'

export interface Reporte {
  id: string
  type: TipoReporte
  /** Qué servicio es. Null en 176 de 180: solo lo traen los de tipo `support`. */
  category: string | null
  risk: RiesgoReporte
  /** Clase del daño, de una lista cerrada que elige quien reporta. */
  title: string
  /**
   * Pese al nombre, NO es el barrio.
   *
   * El esquema lo ejemplifica como "Barrio Boston", pero en el formulario de la
   * fuente este campo es la nota opcional ("Nota — ej. hay paso restringido").
   * En los datos reales 163 de 180 traen el relleno "Ubicación registrada", que
   * es lo que se guarda cuando nadie escribió nada. Enseñarlo como si fuera una
   * dirección sería inventar una ubicación que la fuente no da.
   */
  area: string
  /** [lat, lng]. Presente en los 180 reportes visibles. */
  coords: [number, number]
  createdAt: string
  /**
   * URLs absolutas a `/api/photos/{id}`. Sin miniaturas: ver nota en index.ts.
   *
   * Puede venir vacío. En `housing`, `road` y `support` la fuente exige al
   * menos una foto al publicar, pero en `utility` es opcional —un corte de luz
   * no se fotografía— y el único reporte de ese tipo llegó sin ninguna.
   */
  photos: string[]
  /** Balance de votos. */
  score: number
  /** Votos totales. */
  votes: number
  /** Voto del visitante. Siempre 0 para integraciones; no lo usamos. */
  userVote: -1 | 0 | 1
}

export interface RespuestaLista {
  reports: Reporte[]
}

/** Cuerpo de error de la API: `{"error":"Tipo inválido."}`. */
export interface RespuestaError {
  error: string
}

/** El relleno que la fuente guarda cuando la nota se deja en blanco. */
export const NOTA_VACIA = 'Ubicación registrada'
