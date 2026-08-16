/**
 * Preparar una foto de teléfono para enviarla.
 *
 * Sin esto no hay reporte que llegue. Las fotos de la propia fuente pesan entre
 * 3 y 7 MB porque nadie las redimensiona en origen —eso está medido, y es la
 * razón de que esta app no las cargue solas—, y una función de Vercel rechaza
 * con 413 cualquier cuerpo de más de 4,5 MB. En Base64 el peso sube otro tercio.
 * Así que una sola foto sin tocar ya no cabría.
 *
 * Y hay algo peor que el peso: quien está reportando un edificio agrietado está
 * en la calle, con datos móviles y con prisa. Subir 5 MB por foto puede tardar
 * minutos y costarle dinero. Reducirla a 1600 px de lado y calidad 0,82 la deja
 * en unos 300 KB sin perder nada de lo que hace útil la evidencia: se sigue
 * viendo la grieta, la inclinación y el trozo de fachada que falta.
 *
 * `imageOrientation: 'from-image'` no es un detalle: sin él las fotos verticales
 * de muchos teléfonos llegan tumbadas, porque la rotación vive en los metadatos
 * EXIF y el lienzo los ignora. Una foto de un edificio girada 90° es una foto
 * de un edificio que parece otra cosa.
 */

export interface FotoPreparada {
  /** Los tres formatos que admite la fuente; siempre salimos en JPEG. */
  contentType: 'image/jpeg'
  /** Bytes en Base64, sin el prefijo `data:` que el contrato prohíbe. */
  data: string
  /** Tamaño ya codificado, para poder decir cuánto se va a enviar. */
  bytes: number
  /** Para la vista previa. Hay que revocarlo al descartar la foto. */
  vistaPrevia: string
  ancho: number
  alto: number
}

const LADO_MAX = 1600
const CALIDAD = 0.82

/** Formatos que el navegador nos deja abrir y la fuente aceptaría. */
export const FORMATOS_ACEPTADOS = 'image/jpeg,image/png,image/webp'

async function aBitmap(archivo: File): Promise<{ ancho: number; alto: number; dibujar: CanvasImageSource }> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
      return { ancho: bitmap.width, alto: bitmap.height, dibujar: bitmap }
    } catch {
      /* Algún navegador no admite la opción de orientación: se cae al <img>. */
    }
  }

  // Respaldo: un <img> respeta el EXIF al pintarse, aunque cuesta más memoria.
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const el = new Image()
      el.onload = () => resolver(el)
      el.onerror = () => rechazar(new Error('No se pudo leer la imagen.'))
      el.src = url
    })
    return { ancho: img.naturalWidth, alto: img.naturalHeight, dibujar: img }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function prepararFoto(archivo: File): Promise<FotoPreparada> {
  if (!archivo.type.startsWith('image/')) {
    throw new Error('Ese archivo no es una imagen.')
  }

  const { ancho, alto, dibujar } = await aBitmap(archivo)
  if (!ancho || !alto) throw new Error('No se pudo leer la imagen.')

  const escala = Math.min(1, LADO_MAX / Math.max(ancho, alto))
  const w = Math.max(1, Math.round(ancho * escala))
  const h = Math.max(1, Math.round(alto * escala))

  const lienzo = document.createElement('canvas')
  lienzo.width = w
  lienzo.height = h
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('Este navegador no puede procesar la imagen.')
  ctx.drawImage(dibujar, 0, 0, w, h)
  if ('close' in dibujar && typeof dibujar.close === 'function') dibujar.close()

  const blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, 'image/jpeg', CALIDAD),
  )
  if (!blob) throw new Error('No se pudo preparar la imagen.')

  const data = await aBase64(blob)
  return {
    contentType: 'image/jpeg',
    data,
    bytes: blob.size,
    vistaPrevia: URL.createObjectURL(blob),
    ancho: w,
    alto: h,
  }
}

/**
 * Blob a Base64 pelado.
 *
 * `FileReader` devuelve un `data:` URL y el contrato pide los bytes sin ese
 * prefijo, así que se corta por la primera coma. Se hace con FileReader y no
 * con `btoa` sobre el buffer porque para varios megas el segundo camino monta
 * una cadena intermedia enorme y en un teléfono modesto eso es una pestaña que
 * se cierra sola.
 */
function aBase64(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onerror = () => rechazar(new Error('No se pudo leer la imagen.'))
    lector.onload = () => {
      const texto = String(lector.result ?? '')
      const coma = texto.indexOf(',')
      if (coma < 0) {
        rechazar(new Error('No se pudo leer la imagen.'))
        return
      }
      resolver(texto.slice(coma + 1))
    }
    lector.readAsDataURL(blob)
  })
}

/** "320 KB" / "1,2 MB". Para poder decir cuánto se va a subir antes de subirlo. */
export function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
