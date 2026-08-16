import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * El único trozo de esta aplicación que corre en un servidor.
 *
 * Existe por una frase de la documentación de Pereira Responde: *"Nunca
 * publiques la clave en JavaScript del navegador"*. Su endpoint de escritura
 * pide `Authorization: Bearer <API_KEY>` y es explícitamente
 * servidor-a-servidor. En una aplicación de Vite todo lo que empieza por
 * `VITE_` acaba dentro del bundle, así que meter la clave ahí sería publicarla:
 * cualquiera podría leerla del JavaScript, quemar el límite de cinco reportes
 * por minuto y llenar de basura la cola de moderación de la fuente, y la única
 * salida sería que el administrador la revocara.
 *
 * Así que el navegador habla con esto, y esto habla con la fuente. La clave
 * vive en `PEREIRA_RESPONDE_API_KEY`, una variable de entorno del servidor **sin
 * prefijo `VITE_`** para que el empaquetador no pueda tocarla ni por error.
 *
 * Lo que este proxy NO puede evitar, y conviene tenerlo escrito: al ser público
 * y sin registro —como toda la app—, cualquiera puede publicar a través de él.
 * Lo que sí hace es no ser un amplificador cómodo: valida el mismo contrato que
 * la fuente antes de gastar cuota, recorta el cuerpo mucho antes del límite de
 * la plataforma y frena los envíos en ráfaga. La moderación de la fuente sigue
 * siendo la última palabra, como en su propio formulario.
 */

const DESTINO = 'https://pereiraresponde.co/api/public/v1/reports'

/**
 * Tope del cuerpo, muy por debajo de los 30 MB que admite la fuente.
 *
 * No es una preferencia: una función de Vercel rechaza con 413 lo que pase de
 * 4,5 MB, y ese 413 llegaría *después* de que alguien con datos móviles haya
 * subido la foto entera. El cliente redimensiona antes de enviar —una foto de
 * teléfono baja de 5 MB a unos 300 KB— así que 3,5 MB deja sitio de sobra para
 * las tres fotos que permite el contrato.
 */
const MAX_CUERPO = 3.5 * 1024 * 1024

/** Lo que admite el contrato, copiado tal cual de su OpenAPI. */
const TIPOS = ['housing', 'road', 'support'] as const
const RIESGOS_POR_TIPO: Record<string, readonly string[]> = {
  housing: ['high', 'medium'],
  road: ['road'],
  support: ['support'],
}
const CATEGORIAS_APOYO = [
  'hospital',
  'shelter',
  'collection',
  'store',
  'pharmacy',
  'veterinary',
  'supplies',
] as const
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * Freno de ráfaga, del alcance que se puede tener aquí.
 *
 * Vive en memoria, así que solo cubre la instancia que atiende la petición y se
 * pierde en cada arranque en frío. Es honesto decir lo que es: no es un muro
 * contra un ataque decidido, es lo que evita que un botón que se queda pulsado
 * o un reintento en bucle se coman la cuota de la clave en diez segundos. El
 * límite de verdad —cinco por minuto— lo pone la fuente.
 */
const VENTANA_MS = 60_000
const MAX_POR_VENTANA = 5
const enviosRecientes: number[] = []

function hayHueco(): boolean {
  const ahora = Date.now()
  while (enviosRecientes.length > 0 && ahora - enviosRecientes[0] > VENTANA_MS) {
    enviosRecientes.shift()
  }
  return enviosRecientes.length < MAX_POR_VENTANA
}

/* -------------------------------- Utilidades ------------------------------- */

function responder(res: ServerResponse, codigo: number, cuerpo: unknown): void {
  res.statusCode = codigo
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(cuerpo))
}

async function leerCuerpo(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  // En Vercel el cuerpo ya viene parseado; en el servidor de desarrollo, no.
  if (req.body !== undefined && req.body !== null && typeof req.body !== 'string') {
    return req.body
  }

  const trozos: Buffer[] = []
  let total = 0
  for await (const trozo of req) {
    const buf = trozo as Buffer
    total += buf.length
    if (total > MAX_CUERPO) throw new Error('demasiado-grande')
    trozos.push(buf)
  }
  if (total === 0) return null
  return JSON.parse(Buffer.concat(trozos).toString('utf8'))
}

interface FotoEntrante {
  contentType: string
  data: string
}

interface ReporteEntrante {
  type: string
  category?: string | null
  risk: string
  title: string
  note?: string | null
  coords: [number, number]
  photos: FotoEntrante[]
}

/**
 * Se valida aquí lo mismo que valida la fuente.
 *
 * No es desconfianza del formulario propio: es que un 400 al otro lado consume
 * un intento del límite por minuto y devuelve "Datos de reporte inválidos.", sin
 * decir cuál. Cazarlo antes cuesta treinta líneas y ahorra que un fallo tonto
 * deje la clave sin cuota justo cuando alguien tiene algo urgente que publicar.
 */
function validar(cuerpo: unknown): { ok: true; reporte: ReporteEntrante } | { ok: false; error: string } {
  if (!cuerpo || typeof cuerpo !== 'object') return { ok: false, error: 'Falta el contenido del reporte.' }
  const c = cuerpo as Record<string, unknown>

  const type = String(c.type ?? '')
  if (!TIPOS.includes(type as (typeof TIPOS)[number])) {
    return { ok: false, error: 'El tipo de reporte no es válido.' }
  }

  const risk = String(c.risk ?? '')
  if (!RIESGOS_POR_TIPO[type].includes(risk)) {
    return { ok: false, error: 'Esa gravedad no corresponde a ese tipo de reporte.' }
  }

  /* `category` es obligatoria en `support` y tiene que ir vacía en el resto.
     La fuente responde 400 sin distinguir cuál de las dos cosas falló. */
  const category = c.category == null ? null : String(c.category)
  if (type === 'support') {
    if (!category || !CATEGORIAS_APOYO.includes(category as (typeof CATEGORIAS_APOYO)[number])) {
      return { ok: false, error: 'Falta decir qué servicio es.' }
    }
  } else if (category) {
    return { ok: false, error: 'Solo los servicios abiertos llevan categoría.' }
  }

  const title = String(c.title ?? '').trim()
  if (title.length < 1 || title.length > 200) {
    return { ok: false, error: 'Falta la clase de afectación.' }
  }

  const note = c.note == null ? null : String(c.note).trim()
  if (note && note.length > 1000) return { ok: false, error: 'La nota es demasiado larga.' }

  const coords = c.coords
  if (
    !Array.isArray(coords) ||
    coords.length !== 2 ||
    typeof coords[0] !== 'number' ||
    typeof coords[1] !== 'number' ||
    !Number.isFinite(coords[0]) ||
    !Number.isFinite(coords[1]) ||
    coords[0] < -90 ||
    coords[0] > 90 ||
    coords[1] < -180 ||
    coords[1] > 180
  ) {
    return { ok: false, error: 'Falta la ubicación del reporte.' }
  }

  const photos = c.photos
  if (!Array.isArray(photos) || photos.length < 1 || photos.length > 3) {
    return { ok: false, error: 'Hace falta al menos una foto, y como mucho tres.' }
  }
  const fotos: FotoEntrante[] = []
  for (const f of photos) {
    if (!f || typeof f !== 'object') return { ok: false, error: 'Una de las fotos no llegó bien.' }
    const foto = f as Record<string, unknown>
    const contentType = String(foto.contentType ?? '')
    const data = String(foto.data ?? '')
    if (!TIPOS_FOTO.includes(contentType as (typeof TIPOS_FOTO)[number])) {
      return { ok: false, error: 'Ese formato de imagen no se admite.' }
    }
    // Sin prefijo `data:`: el contrato pide los bytes pelados en Base64.
    if (!data || data.startsWith('data:') || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      return { ok: false, error: 'Una de las fotos no llegó bien.' }
    }
    fotos.push({ contentType, data })
  }

  return {
    ok: true,
    reporte: {
      type,
      category: type === 'support' ? category : null,
      risk,
      title,
      note: note || null,
      coords: [coords[0], coords[1]],
      photos: fotos,
    },
  }
}

/* --------------------------------- Manejador ------------------------------- */

export default async function handler(
  req: IncomingMessage & { method?: string; body?: unknown },
  res: ServerResponse,
): Promise<void> {
  const clave = process.env.PEREIRA_RESPONDE_API_KEY?.trim()

  /* GET: ¿se puede publicar? La pantalla lo pregunta antes de ofrecer el
     formulario. Nunca devuelve la clave ni una pista de ella: solo si existe.
     Sin esto habría que enseñar un formulario que falla al enviar, que es la
     peor forma de descubrir que la integración no está configurada. */
  if (req.method === 'GET') {
    responder(res, 200, { disponible: !!clave })
    return
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    responder(res, 405, { error: 'Método no permitido.' })
    return
  }

  if (!clave) {
    responder(res, 503, {
      error: 'Esta instalación no tiene configurada la clave para publicar reportes.',
    })
    return
  }

  let cuerpo: unknown
  try {
    cuerpo = await leerCuerpo(req)
  } catch (e) {
    if (e instanceof Error && e.message === 'demasiado-grande') {
      responder(res, 413, { error: 'Las fotos pesan demasiado. Envía menos o más pequeñas.' })
      return
    }
    responder(res, 400, { error: 'No se entendió el contenido enviado.' })
    return
  }

  const revision = validar(cuerpo)
  if (!revision.ok) {
    responder(res, 400, { error: revision.error })
    return
  }

  if (!hayHueco()) {
    responder(res, 429, {
      error: 'Se están enviando muchos reportes seguidos. Espera un minuto y reinténtalo.',
    })
    return
  }

  let respuesta: Response
  try {
    enviosRecientes.push(Date.now())
    respuesta = await fetch(DESTINO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${clave}`,
      },
      body: JSON.stringify(revision.reporte),
    })
  } catch {
    responder(res, 502, { error: 'No se pudo hablar con Pereira Responde. Inténtalo de nuevo.' })
    return
  }

  const texto = await respuesta.text()

  if (respuesta.ok) {
    res.statusCode = respuesta.status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(texto || '{}')
    return
  }

  /* Un 401 es culpa de la configuración, no de quien reporta, y decirle
     "clave inválida" a alguien que está en la calle frente a un edificio
     agrietado no le sirve de nada. Se traduce a lo único accionable —vuelve a
     intentarlo o repórtalo en la fuente— y el detalle queda en el registro del
     servidor, que es donde lo puede leer quien mantiene esto. */
  console.error('[pereira-responde] escritura rechazada', respuesta.status, texto.slice(0, 300))

  const mensajes: Record<number, string> = {
    400: 'La fuente rechazó el reporte por su contenido.',
    401: 'Esta instalación no puede publicar ahora mismo.',
    413: 'Las fotos pesan demasiado para la fuente.',
    429: 'La fuente está limitando las publicaciones. Espera un minuto.',
    502: 'La fuente no pudo guardar las fotos. Inténtalo de nuevo.',
  }
  responder(res, respuesta.status >= 500 ? 502 : respuesta.status, {
    error: mensajes[respuesta.status] ?? 'La fuente no aceptó el reporte.',
  })
}
