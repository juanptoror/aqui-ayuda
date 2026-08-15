import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Backend } from '@/backends/contrato'
import type { Alojamiento } from '@/dominio/modelos'
import { ErrorApp, traducirError } from '@/lib/errores'

/**
 * Backend "Vivienda": inmuebles en arriendo.
 *
 * Es el más distinto de los cuatro: no habla de la emergencia, habla de dónde
 * vivir. Se conecta porque después de un terremoto eso *es* una necesidad de
 * primera línea —quien perdió la casa necesita otra, no una caja de arroz—.
 *
 * Lo que el perfilado de sus 30 filas dejó claro, y condiciona todo lo demás:
 *
 * 1. **El esquema está duplicado en español y en inglés, y solo el inglés tiene
 *    datos.** `titulo`, `precio`, `ciudad`, `direccion`, `imagenes`… están
 *    vacías en las 30 filas. Se leen únicamente las columnas en inglés.
 * 2. **`habitaciones`, `banos`, `parqueaderos` y `garages` son 0 en todas.** El
 *    dato real vive en `bedrooms`, `bathrooms` y `parking`. Son columnas
 *    muertas rellenas de ceros, no información.
 * 3. **Las coordenadas son falsas.** `lat` es 4.7 en las 30 filas y `lng` solo
 *    toma dos valores: -74.05 (Bogotá) y 0. Los inmuebles están en Armenia, a
 *    150 km de ahí. Por eso este backend NO expone coordenada: enseñar un pin
 *    en Bogotá para un apartamento de Armenia es peor que no enseñar mapa.
 * 4. **El precio solo está en la columna en 7 de 30.** En el resto el canon
 *    está escrito dentro de la descripción ("Canon: $850.000 sin parqueadero").
 *    Un filtro de precio que descarte silenciosamente 23 de 30 mentiría, así
 *    que el precio se trata como opcional y la pantalla lo dice.
 */

const url = import.meta.env.VITE_VIVIENDA_URL
const anonKey = import.meta.env.VITE_VIVIENDA_ANON_KEY

export const configuracionIncompleta: string | null =
  !url || !anonKey ? 'Falta la configuración de conexión con el listado de vivienda.' : null

const cliente: SupabaseClient = createClient(url ?? '', anonKey ?? '', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { 'x-application-name': 'aquiayuda-web' } },
})

/* Solo las columnas con datos reales. Las 50 restantes son ruido comprobado. */
export const COLUMNAS_INMUEBLE =
  'id,created_at,title,description,price,type,city,neighborhood,area,bedrooms,bathrooms,parking,images,owner_whatsapp,contact_count,transaction' as const

interface FilaInmueble {
  id: string
  created_at: string
  title: string | null
  description: string | null
  price: number | null
  type: string | null
  city: string | null
  neighborhood: string | null
  area: number | null
  bedrooms: number | null
  bathrooms: number | null
  parking: number | null
  images: string[] | null
  owner_whatsapp: string | null
  contact_count: number | null
  transaction: string | null
}

export interface Inmueble {
  id: string
  titulo: string
  descripcion: string | null
  /** null cuando el anuncio no lo puso en el campo: 23 de 30 están así. */
  precio: number | null
  /** El canon escrito dentro del texto, cuando `precio` viene vacío. */
  precioEnTexto: string | null
  tipo: string
  ciudad: string
  barrio: string | null
  areaM2: number | null
  habitaciones: number
  banos: number
  parqueaderos: number
  imagenes: string[]
  whatsapp: string | null
  contactos: number
  publicadoEn: string
}

/**
 * Rescata el canon del texto libre.
 *
 * No es una floritura: sin esto, 23 de los 30 anuncios aparecerían como "precio
 * a consultar" teniéndolo escrito dos líneas más abajo. Se marca aparte del
 * precio del campo porque no se puede ordenar ni filtrar con la misma
 * confianza: es texto que alguien escribió, no un número validado.
 */
function precioDelTexto(texto: string | null): string | null {
  if (!texto) return null
  const m = texto.match(/\$\s?([\d.,']{6,15})/)
  return m ? `$${m[1]}` : null
}

/** "armenia" y "Armenia" son la misma ciudad; la fuente no lo normaliza. */
export function normalizarCiudad(c: string | null): string {
  const t = (c ?? '').trim()
  if (!t) return 'Sin ciudad'
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

function aInmueble(f: FilaInmueble): Inmueble {
  return {
    id: f.id,
    titulo: f.title?.trim() || 'Inmueble sin título',
    descripcion: f.description?.trim() || null,
    precio: f.price && f.price > 0 ? f.price : null,
    precioEnTexto: f.price && f.price > 0 ? null : precioDelTexto(f.description),
    tipo: f.type?.trim() || 'Sin tipo',
    ciudad: normalizarCiudad(f.city),
    barrio: f.neighborhood?.trim() || null,
    areaM2: f.area && f.area > 0 ? f.area : null,
    habitaciones: f.bedrooms ?? 0,
    banos: f.bathrooms ?? 0,
    parqueaderos: f.parking ?? 0,
    imagenes: Array.isArray(f.images) ? f.images.filter(Boolean) : [],
    whatsapp: f.owner_whatsapp?.trim() || null,
    contactos: f.contact_count ?? 0,
    publicadoEn: f.created_at,
  }
}

export async function leerInmuebles(): Promise<Inmueble[]> {
  if (configuracionIncompleta) {
    throw new ErrorApp({
      mensaje: 'La aplicación no está bien configurada.',
      sugerencia: 'Avisa a soporte con este código.',
      codigo: 'VI-CFG0',
      reintentable: false,
    })
  }

  const { data, error } = await cliente
    .from('inmuebles')
    .select(COLUMNAS_INMUEBLE)
    .order('created_at', { ascending: false })

  if (error) throw new ErrorApp(traducirError(error, 'VI'), error)
  return ((data ?? []) as unknown as FilaInmueble[]).map(aInmueble)
}

export interface BorradorInmueble {
  titulo: string
  descripcion: string
  tipo: string
  ciudad: string
  barrio: string
  precio: number | null
  habitaciones: number
  banos: number
  parqueaderos: number
  areaM2: number | null
  whatsapp: string
}

/**
 * Publicar un inmueble.
 *
 * Escribe en las columnas EN, que son las que la fuente lee de verdad; poner el
 * dato en las columnas ES lo dejaría invisible para su propia aplicación.
 *
 * No se ha comprobado si la clave pública tiene permiso de escritura: probarlo
 * exigía insertar una fila en una base de datos de producción ajena, y eso no
 * se hace para salir de dudas. Si no lo tiene, el error llega traducido con su
 * código de soporte, como cualquier otro.
 */
export async function publicarInmueble(b: BorradorInmueble): Promise<void> {
  if (configuracionIncompleta) {
    throw new ErrorApp({
      mensaje: 'La aplicación no está bien configurada.',
      sugerencia: 'Avisa a soporte con este código.',
      codigo: 'VI-CFG0',
      reintentable: false,
    })
  }

  const { error } = await cliente.from('inmuebles').insert({
    title: b.titulo.trim(),
    description: b.descripcion.trim() || null,
    type: b.tipo,
    city: b.ciudad.trim(),
    neighborhood: b.barrio.trim() || null,
    price: b.precio ?? 0,
    bedrooms: b.habitaciones,
    bathrooms: b.banos,
    parking: b.parqueaderos,
    area: b.areaM2 ?? 0,
    owner_whatsapp: b.whatsapp.trim(),
    transaction: 'arriendo',
    status: 'disponible',
    images: [],
  } as never)

  if (error) throw new ErrorApp(traducirError(error, 'VI'), error)
}

/** Enlace de WhatsApp al propietario, con el anuncio ya citado. */
export function enlaceArrendador(numero: string | null, titulo: string): string | null {
  if (!numero) return null
  const d = numero.replace(/\D/g, '')
  if (d.length < 10) return null
  const con57 = d.startsWith('57') ? d : `57${d}`
  return `https://wa.me/${con57}?text=${encodeURIComponent(
    `Hola, vi tu publicación "${titulo}" en AquíAyuda y me interesa.`,
  )}`
}

/**
 * El mismo listado, ya traducido al modelo común de alojamiento.
 *
 * `lat` y `lng` salen deliberadamente a null: la fuente publica 4.7/-74.05
 * —Bogotá— para inmuebles que están en Armenia. Propagar esa coordenada
 * pondría pines a 150 km del sitio real, y en una emergencia eso manda a
 * alguien a coger una carretera para nada.
 */
function aAlojamiento(i: Inmueble): Alojamiento {
  return {
    id: `vi-${i.id}`,
    origen: 'vivienda',
    titulo: i.titulo,
    descripcion: i.descripcion,
    tipo: i.tipo,
    ciudad: i.ciudad,
    departamento: null,
    barrio: i.barrio,
    direccion: null,
    precioMes: i.precio,
    precioEnTexto: i.precioEnTexto,
    amoblado: null,
    // 0 no es cero habitaciones: es que nadie lo rellenó (22 de 30).
    habitaciones: i.habitaciones > 0 ? i.habitaciones : null,
    banos: i.banos > 0 ? i.banos : null,
    parqueaderos: i.parqueaderos > 0 ? i.parqueaderos : null,
    areaM2: i.areaM2,
    disponible: true,
    lat: null,
    lng: null,
    fotos: i.imagenes,
    telefono: i.whatsapp,
    contactos: i.contactos,
    publicadoEn: i.publicadoEn,
  }
}

export const vivienda: Backend = {
  descripcion: {
    id: 'vivienda',
    nombre: 'Encuéntralo a un Clic',
    tipo: 'Vivienda en arriendo',
    descripcion: 'Inmuebles en arriendo con fotos, sobre todo en el Quindio.',
    quienPublica: 'Propietarios e inmobiliarias.',
    url: 'https://encuentraloaunclic.com',
    capacidades: ['leer:alojamientos', 'escribir:alojamiento'],
  },

  leer: {
    async alojamientos(): Promise<Alojamiento[]> {
      const inmuebles = await leerInmuebles()
      return inmuebles.map(aAlojamiento)
    },
  },

  escribir: {
    alojamiento: publicarInmueble,
  },
}
