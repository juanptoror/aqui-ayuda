/**
 * Enlaces a mapas externos, sin API de pago.
 *
 * La API JavaScript de Google Maps se factura por carga de mapa. Aquí no hace
 * falta: lo que la gente necesita es *llegar*, y para eso basta con abrir la
 * app de mapas que ya tiene instalada. Un enlace cuesta cero, funciona en
 * Android y en iPhone, y hereda el tráfico y la navegación por voz que nosotros
 * jamás vamos a implementar.
 *
 * El mapa propio de la aplicación sigue siendo el SVG dibujado en el
 * dispositivo: sirve para *ver el conjunto* —quién está cerca de qué— que es
 * justo lo que un enlace externo no puede dar.
 */

export interface Destino {
  lat?: number | null
  lng?: number | null
  /** Dirección escrita. Es el respaldo cuando no hay coordenada. */
  direccion?: string | null
  /** Barrio o municipio, para desambiguar una dirección suelta. */
  zona?: string | null
  /** Nombre del sitio. Va como etiqueta del pin cuando hay coordenada. */
  nombre?: string | null
}

/** Colombia continental e insular, con holgura. Descarta el (0,0) y los ceros. */
export function coordenadaPlausible(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat === 0 && lng === 0) return false
  return lat >= -5 && lat <= 14 && lng >= -82 && lng <= -66
}

/**
 * Texto de búsqueda cuando no hay coordenada.
 *
 * Se añade "Colombia" porque una dirección como "Calle 40 #15-22" existe en
 * media docena de países y el mapa abriría en el continente equivocado.
 */
function consultaDeTexto(d: Destino): string | null {
  const partes = [d.direccion, d.zona].filter((p): p is string => !!p?.trim())
  if (partes.length === 0) return null
  // "Cuba · Cuba": el origen duplica barrio y dirección con frecuencia.
  const unicas = [...new Set(partes.map((p) => p.trim()))]
  return [...unicas, 'Colombia'].join(', ')
}

/**
 * Abre el mapa centrado en el sitio, con un pin.
 *
 * Con coordenada se usa `query=lat,lng` porque es exacto; el nombre viaja en
 * `query_place_id`… no, ahí no cabe, así que el nombre se pierde. Es el
 * compromiso correcto: preferimos el pin en el punto exacto a un pin
 * etiquetado pero puesto donde el buscador crea.
 */
export function enlaceVerEnMapa(d: Destino): string | null {
  if (coordenadaPlausible(d.lat, d.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`
  }
  const texto = consultaDeTexto(d)
  return texto ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}` : null
}

/**
 * Abre la navegación paso a paso hacia el sitio.
 *
 * No se fija el origen a propósito: Google usa la posición real del móvil, que
 * es más fiable que la que nos dio el navegador y no obliga a conceder permiso
 * de ubicación solo para pulsar un botón.
 */
export function enlaceComoLlegar(d: Destino): string | null {
  if (coordenadaPlausible(d.lat, d.lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`
  }
  const texto = consultaDeTexto(d)
  return texto
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(texto)}`
    : null
}

/** Qué precisión tiene el enlace, para no prometer más de lo que hay. */
export function precisionDestino(d: Destino): 'exacta' | 'aproximada' | 'ninguna' {
  if (coordenadaPlausible(d.lat, d.lng)) return 'exacta'
  return consultaDeTexto(d) ? 'aproximada' : 'ninguna'
}
