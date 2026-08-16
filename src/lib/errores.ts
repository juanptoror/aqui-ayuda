/**
 * Traductor de errores a lenguaje humano.
 *
 * Regla: el usuario NUNCA ve un código de PostgREST, un stack ni la palabra
 * "Supabase". Ve qué pasó, qué puede hacer, y un código corto para dictárselo
 * a soporte por teléfono. El detalle técnico va a la consola, que es donde
 * sirve.
 *
 * El código tiene forma `AP-4F2K`: dos letras de origen y cuatro caracteres
 * derivados del error. Es estable —el mismo fallo produce el mismo código— para
 * que soporte pueda agrupar incidencias, y no lleva datos personales.
 */

export type OrigenError = 'AP' | 'CG' | 'PU' | 'VI' | 'PR' | 'AP-AUTH' | 'APP'

export interface ErrorParaElUsuario {
  /** Qué pasó, en una frase, sin jerga. */
  mensaje: string
  /** Qué puede hacer la persona ahora. */
  sugerencia: string
  /** Código corto para dictar a soporte. */
  codigo: string
  /** true si reintentar tiene sentido (red), false si es permanente. */
  reintentable: boolean
}

/** Alfabeto sin caracteres que se confunden al dictar: 0/O, 1/I/L. */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

function codigoDe(origen: OrigenError, semilla: string): string {
  let h = 2166136261
  for (let i = 0; i < semilla.length; i++) {
    h ^= semilla.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let sufijo = ''
  let n = h >>> 0
  for (let i = 0; i < 4; i++) {
    sufijo += ALFABETO[n % ALFABETO.length]
    n = Math.floor(n / ALFABETO.length)
  }
  return `${origen}-${sufijo}`
}

/**
 * Error de la app con mensaje ya traducido. Se lanza desde la capa de backend
 * para que la UI no tenga que interpretar códigos de nadie.
 */
export class ErrorApp extends Error {
  readonly paraElUsuario: ErrorParaElUsuario

  constructor(paraElUsuario: ErrorParaElUsuario, causaTecnica?: unknown) {
    super(paraElUsuario.mensaje)
    this.name = 'ErrorApp'
    this.paraElUsuario = paraElUsuario

    // El detalle crudo va a la consola, nunca a la pantalla.
    if (causaTecnica) {
      console.error(`[${paraElUsuario.codigo}]`, causaTecnica)
    }
  }
}

interface ErrorCrudo {
  code?: string
  message?: string
  status?: number
}

/**
 * Convierte cualquier cosa que haya fallado en algo que se pueda enseñar.
 * Es exhaustivo a propósito: si aparece un caso nuevo, cae en el genérico y
 * sigue siendo legible, nunca en un volcado técnico.
 */
export function traducirError(error: unknown, origen: OrigenError = 'APP'): ErrorParaElUsuario {
  const crudo: ErrorCrudo =
    error && typeof error === 'object'
      ? (error as ErrorCrudo)
      : { message: String(error ?? 'desconocido') }

  const codigo = crudo.code ?? String(crudo.status ?? '')
  const texto = (crudo.message ?? '').toLowerCase()
  const semilla = `${origen}|${codigo}|${texto.slice(0, 40)}`
  const cod = codigoDe(origen, semilla)

  // Sin conexión: es lo más frecuente en emergencia y merece su propio mensaje.
  if (
    texto.includes('failed to fetch') ||
    texto.includes('networkerror') ||
    texto.includes('load failed') ||
    crudo.status === 0
  ) {
    return {
      mensaje: 'No hay conexión con el servidor.',
      sugerencia: 'Revisa tus datos o el wifi y vuelve a intentarlo.',
      codigo: cod,
      reintentable: true,
    }
  }

  // Permiso denegado a nivel de tabla o columna.
  if (codigo === '42501' || crudo.status === 401 || crudo.status === 403) {
    return {
      mensaje: 'Esta información no está disponible sin iniciar sesión.',
      sugerencia: 'Entra con tu correo para verla.',
      codigo: cod,
      reintentable: false,
    }
  }

  // Registro duplicado.
  if (codigo === '23505') {
    return {
      mensaje: 'Esto ya estaba registrado.',
      sugerencia: 'No hace falta que lo envíes otra vez.',
      codigo: cod,
      reintentable: false,
    }
  }

  // Referencia a algo que ya no existe.
  if (codigo === '23503') {
    return {
      mensaje: 'El centro o la necesidad ya no está disponible.',
      sugerencia: 'Vuelve atrás y elige otro; puede que lo hayan cerrado.',
      codigo: cod,
      reintentable: false,
    }
  }

  // Falta un dato obligatorio.
  if (codigo === '23502' || crudo.status === 400) {
    return {
      mensaje: 'Faltan datos o alguno no tiene el formato esperado.',
      sugerencia: 'Revisa el formulario y vuelve a enviarlo.',
      codigo: cod,
      reintentable: false,
    }
  }

  if (crudo.status === 404 || codigo === 'PGRST205') {
    return {
      mensaje: 'No encontramos lo que buscabas.',
      sugerencia: 'Puede que lo hayan retirado. Vuelve al listado.',
      codigo: cod,
      reintentable: false,
    }
  }

  if (crudo.status === 429 || texto.includes('rate limit') || texto.includes('too many')) {
    return {
      mensaje: 'Demasiados intentos seguidos.',
      sugerencia: 'Espera un minuto y vuelve a intentarlo.',
      codigo: cod,
      reintentable: true,
    }
  }

  if (crudo.status != null && crudo.status >= 500) {
    return {
      mensaje: 'El servidor no está respondiendo bien ahora mismo.',
      sugerencia: 'No es culpa tuya. Inténtalo en unos minutos.',
      codigo: cod,
      reintentable: true,
    }
  }

  // Códigos de sesión, que llegan en inglés desde el proveedor de correo.
  if (texto.includes('invalid') && texto.includes('token')) {
    return {
      mensaje: 'El código no es válido o ya caducó.',
      sugerencia: 'Pide uno nuevo y escríbelo sin espacios.',
      codigo: cod,
      reintentable: false,
    }
  }
  if (texto.includes('expired')) {
    return {
      mensaje: 'El código caducó.',
      sugerencia: 'Pide uno nuevo.',
      codigo: cod,
      reintentable: false,
    }
  }
  if (texto.includes('invalid email') || texto.includes('unable to validate email')) {
    return {
      mensaje: 'Ese correo no parece válido.',
      sugerencia: 'Revísalo y vuelve a intentarlo.',
      codigo: cod,
      reintentable: false,
    }
  }

  return {
    mensaje: 'Algo salió mal y no pudimos completarlo.',
    sugerencia: 'Vuelve a intentarlo. Si sigue fallando, pásale este código a soporte.',
    codigo: cod,
    reintentable: true,
  }
}

/** Envuelve cualquier error en un ErrorApp ya traducido. */
export function comoErrorApp(error: unknown, origen: OrigenError = 'APP'): ErrorApp {
  if (error instanceof ErrorApp) return error
  return new ErrorApp(traducirError(error, origen), error)
}

/** Extrae el mensaje mostrable de cualquier error, traducido si hace falta. */
export function mensajeDe(error: unknown, origen: OrigenError = 'APP'): ErrorParaElUsuario {
  if (error instanceof ErrorApp) return error.paraElUsuario
  return traducirError(error, origen)
}
