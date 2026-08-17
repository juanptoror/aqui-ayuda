import type { Backend } from '@/backends/contrato'
import type { Afectacion, GravedadAfectacion, TipoAfectacion } from '@/dominio/modelos'
import { ErrorApp, traducirError } from '@/lib/errores'
import {
  BASE,
  LIMITE_MAX,
  NOTA_VACIA,
  RUTA_REPORTES,
  URL_FUENTE,
  type Reporte,
  type RespuestaError,
  type RespuestaLista,
  type RiesgoReporte,
  type TipoReporte,
} from './esquema'

/**
 * Backend "Pereira Responde": el estado físico de la ciudad.
 *
 * Quinta fuente, y la única que no habla de ayuda. Las otras cuatro dicen quién
 * necesita qué y quién lo tiene; ésta dice qué edificio está a punto de caerse y
 * por qué calle no se pasa. Para quien conduce una carga hasta un centro de
 * acopio eso cambia la ruta, y para quien duda si volver a su casa cambia la
 * noche.
 *
 * Cuatro rasgos de esta API condicionan todo lo que hay debajo:
 *
 * 1. **La lectura es pública; la escritura, no.** Cualquiera puede consultar los
 *    reportes sin clave, y por eso las consultas de este fichero salen directas
 *    del navegador. Publicar es otra cosa: pide `Authorization: Bearer` y su
 *    documentación dice literalmente "nunca publiques la clave en JavaScript del
 *    navegador". Así que el envío no vive aquí, vive en
 *    [publicar.ts](./publicar.ts), que habla con nuestra propia función de
 *    servidor —la única que ve la clave— y esa función habla con la fuente.
 *
 * 2. **`limit` por defecto es 100 y hoy hay 180 reportes.** No pedirlo recorta
 *    la ciudad casi a la mitad sin avisar. Se pide siempre el máximo (500).
 *
 * 3. **`area` no es el barrio.** El esquema lo ejemplifica como "Barrio Boston",
 *    pero es la nota opcional del formulario y 163 de 180 traen el relleno
 *    "Ubicación registrada". Se descarta ese relleno en vez de pintarlo como si
 *    fuera una dirección.
 *
 * 4. **Las fotos pesan entre 3 y 7 MB cada una**, sin miniatura ni versión
 *    reducida: son el JPEG que salió del teléfono. Con 179 reportes con foto,
 *    una rejilla que las cargue sola son cientos de megas sobre una red que
 *    acaba de sobrevivir a un terremoto. Por eso el modelo trae las URLs pero
 *    NINGUNA pantalla las carga sin que alguien lo pida.
 */

/* Todo el detalle está ya en el listado: `/reports/{id}` devuelve exactamente el
   mismo objeto, campo a campo. No hay segunda petición para la ficha. */
async function pedir<T>(ruta: string, senal?: AbortSignal): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      signal: senal,
      headers: { Accept: 'application/json' },
    })
  } catch (e) {
    // Aborto por cambio de pantalla: no es un fallo que contar a nadie.
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ErrorApp(traducirError(e, 'PR'), e)
  }

  if (!respuesta.ok) {
    /* La API explica en español qué filtro rechazó ("Tipo inválido."). Va a la
       consola junto al código de soporte; a la pantalla llega el mensaje
       traducido, como con cualquier otra fuente. */
    let detalle: string | null = null
    try {
      detalle = ((await respuesta.json()) as RespuestaError).error ?? null
    } catch {
      /* la respuesta de error no era JSON */
    }
    throw new ErrorApp(traducirError({ status: respuesta.status, message: detalle ?? '' }, 'PR'), {
      ruta,
      status: respuesta.status,
      detalle,
    })
  }

  return (await respuesta.json()) as T
}

const TIPO: Record<TipoReporte, TipoAfectacion> = {
  housing: 'vivienda',
  road: 'via',
  support: 'apoyo',
  utility: 'servicio-publico',
}

/* `road`, `support` y `utility` no son gravedades: son el tipo repetido dentro
   del campo de riesgo. Traducirlos a "alta" o "media" pondría una alarma donde
   la fuente no la puso, y traducirlos a "media" bajaría el listón de un colapso. */
const GRAVEDAD: Record<RiesgoReporte, GravedadAfectacion> = {
  high: 'alta',
  medium: 'media',
  road: 'sin-clasificar',
  support: 'sin-clasificar',
  utility: 'sin-clasificar',
}

/** Los dos únicos valores de `category` en los datos, ambos de tipo `support`. */
const SUBTIPO: Record<string, string> = {
  shelter: 'Refugio temporal',
  collection: 'Zona de acopio',
}

function limpio(v: string | null | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

/** Coordenada utilizable, o null. Un cero perdido pone un pin en el Atlántico. */
function coordenada(coords: unknown): { lat: number | null; lng: number | null } {
  if (!Array.isArray(coords) || coords.length < 2) return { lat: null, lng: null }
  const [lat, lng] = coords
  if (typeof lat !== 'number' || typeof lng !== 'number') return { lat: null, lng: null }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null }
  if (lat === 0 && lng === 0) return { lat: null, lng: null }
  return { lat, lng }
}

/**
 * La nota de quien reportó, si escribió alguna.
 *
 * Se descarta el relleno "Ubicación registrada" y también la nota que repite el
 * título: "Colapso total / Colapso total" ocupa una línea y no añade nada.
 */
function nota(area: string | null | undefined, titulo: string): string | null {
  const t = limpio(area)
  if (!t) return null
  if (t === NOTA_VACIA) return null
  if (t.toLowerCase() === titulo.toLowerCase()) return null
  return t
}

function aAfectacion(r: Reporte): Afectacion {
  const titulo = limpio(r.title) ?? 'Afectación sin clasificar'
  const { lat, lng } = coordenada(r.coords)
  const categoria = limpio(r.category)

  return {
    id: r.id,
    /* Ojo con este respaldo: no es inocuo. Cuando la fuente estrenó `utility`,
       cada corte de luz cayó aquí y salió rotulado "Edificio", que es decirle a
       alguien que hay un daño estructural donde solo falta la luz. Al añadir un
       tipo nuevo, `TIPO` es lo primero que hay que tocar. Se deja en 'vivienda'
       —y no en 'apoyo'— porque equivocarse hacia la precaución es preferible a
       pintar de verde algo que nadie ha comprobado. */
    tipo: TIPO[r.type] ?? 'vivienda',
    gravedad: GRAVEDAD[r.risk] ?? 'sin-clasificar',
    titulo,
    /* Una categoría que no conozcamos se muestra cruda en vez de perderse: un
       valor raro en pantalla informa, y uno descartado no. */
    subtipo: categoria ? (SUBTIPO[categoria] ?? categoria) : null,
    nota: nota(r.area, titulo),
    lat,
    lng,
    fotos: Array.isArray(r.photos)
      ? r.photos.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : [],
    confirmaciones: Number.isFinite(r.votes) ? r.votes : 0,
    balance: Number.isFinite(r.score) ? r.score : 0,
    reportadaEn: r.createdAt,
  }
}

/**
 * Todas las afectaciones visibles, de una vez.
 *
 * La API sabe filtrar por tipo, fecha y radio, pero aquí se pide la lista
 * entera —180 reportes, 56 KB— y se filtra en el dispositivo. No es pereza:
 * cada chip de la pantalla sería una petición nueva contra una red que en una
 * emergencia va y viene, y con los datos ya en memoria los filtros responden
 * aunque la red se caiga a mitad. Cuando la ciudad tenga más de 500 reportes
 * habrá que paginar, y la API no ofrece cursor; la pantalla avisa si llegamos
 * al tope en vez de enseñar 500 como si fueran todos.
 */
export async function leerAfectaciones(senal?: AbortSignal): Promise<Afectacion[]> {
  const r = await pedir<RespuestaLista>(`${RUTA_REPORTES}?limit=${LIMITE_MAX}`, senal)
  const reportes = Array.isArray(r?.reports) ? r.reports : []
  return reportes.map(aAfectacion)
}

export const pereiraResponde: Backend = {
  descripcion: {
    id: 'pereira-responde',
    nombre: 'Pereira Responde',
    tipo: 'Daños y vías cerradas',
    descripcion:
      'Edificios afectados, calles cortadas, servicios abiertos y cortes de luz, agua o internet, con coordenada.',
    quienPublica: 'Cualquier persona desde el mapa de Pereira Responde.',
    url: URL_FUENTE,
    capacidades: ['leer:afectaciones', 'escribir:afectacion'],
  },

  leer: {
    afectaciones: () => leerAfectaciones(),
  },

  /* La escritura no encaja en `EscriturasBackend`, que asume una llamada suelta
     desde el navegador: ésta pasa por nuestro servidor, necesita comprimir las
     fotos antes y la pantalla tiene que preguntar primero si hay clave
     configurada. Vive en `publicar.ts` con sus propios hooks; la capacidad se
     declara igual para que la interfaz pueda preguntar por ella. */
  escribir: {},
}

export { LIMITE_MAX, URL_FUENTE }
