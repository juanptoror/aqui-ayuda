import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Backend } from '@/backends/contrato'
import type {
  Alojamiento,
  ComentarioPeticion,
  OfrecimientoPersona,
  PeticionPersona,
} from '@/dominio/modelos'
import { ErrorApp, traducirError } from '@/lib/errores'
import {
  COLUMNAS_COMENTARIO,
  COLUMNAS_OFERTA,
  COLUMNAS_RENTAL,
  COLUMNAS_REPORTE,
  type FilaComentario,
  type FilaOferta,
  type FilaRental,
  type FilaReporte,
} from './esquema'

/**
 * Backend "Pereira Unida".
 *
 * Tercera fuente. Aporta lo que ninguna de las otras dos tiene junto: personas
 * concretas pidiendo ayuda **con teléfono público** y personas ofreciéndola
 * **también con teléfono**. En Ayudas Pereira el teléfono está denegado al rol
 * público, y en Corag solo aparece si quien publica marca la casilla; aquí es
 * parte del dato, porque el tablón nació así.
 *
 * Eso obliga a una decisión que se toma aquí y no en la interfaz: **no
 * republicamos nada que la fuente no publique ya**. Lo que se muestra es
 * exactamente lo que cualquiera ve entrando en Pereira Unida.
 */

const url = import.meta.env.VITE_PU_URL
const anonKey = import.meta.env.VITE_PU_ANON_KEY

export const configuracionIncompleta: string | null =
  !url || !anonKey ? 'Falta la configuración de conexión con Pereira Unida.' : null

/* Sin sesión: este backend no autentica a nadie. Guardar sesión aquí pisaría
   la de Ayudas Pereira, que sí la usa, porque comparten el almacenamiento. */
const cliente: SupabaseClient = createClient(url ?? '', anonKey ?? '', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { 'x-application-name': 'aquiayuda-web' } },
})

async function leer<F>(tabla: string, columnas: string, ajustes?: (q: never) => unknown) {
  if (configuracionIncompleta) {
    throw new ErrorApp({
      mensaje: 'La aplicación no está bien configurada.',
      sugerencia: 'Avisa a soporte con este código.',
      codigo: 'PU-CFG0',
      reintentable: false,
    })
  }
  let consulta = cliente.from(tabla).select(columnas)
  if (ajustes) consulta = ajustes(consulta as never) as typeof consulta

  const { data, error } = await consulta
  if (error) throw new ErrorApp(traducirError(error, 'PU'), error)
  return (data ?? []) as unknown as F[]
}

function limpio(v: string | null | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

/* `urgent_level` viene como texto libre. Se normaliza aquí para que la interfaz
   no tenga que conocer el vocabulario de esta fuente. */
const NIVELES_URGENTES = new Set(['critico', 'crítico', 'urgente', 'alto', 'alta'])

function aPeticion(f: FilaReporte): PeticionPersona {
  return {
    id: f.id,
    titulo: limpio(f.title) ?? 'Petición sin título',
    descripcion: limpio(f.description),
    categoria: limpio(f.category) ?? 'otro',
    urgente: NIVELES_URGENTES.has((f.urgent_level ?? '').toLowerCase().trim()),
    estado: limpio(f.status) ?? 'buscando',
    municipio: limpio(f.municipality),
    departamento: limpio(f.department),
    lugar: limpio(f.location_name),
    lat: f.lat,
    lng: f.lng,
    telefono: limpio(f.contact_phone),
    fotos: Array.isArray(f.photo_urls) ? f.photo_urls.filter(Boolean) : [],
    creadaEn: f.created_at,
    confirmadaEn: f.last_confirmed_at,
  }
}

function aOfrecimiento(f: FilaOferta): OfrecimientoPersona {
  return {
    id: f.id,
    nombre: limpio(f.full_name) ?? 'Sin nombre',
    habilidad: limpio(f.skill) ?? 'otro',
    descripcion: limpio(f.description),
    telefono: limpio(f.phone),
    municipio: limpio(f.municipality),
    departamento: limpio(f.department),
    activo: (f.status ?? 'activa').toLowerCase().trim() === 'activa',
    creadoEn: f.created_at,
  }
}

/* Un titulo legible: la fuente no lo tiene, y "Apartamento" a secas no
   distingue una publicacion de otra en una rejilla de 82. */
function tituloDe(f: FilaRental): string {
  const tipo = f.property_type?.trim() || 'Vivienda'
  const donde = limpio(f.neighborhood) ?? limpio(f.municipality)
  return donde ? `${tipo} en ${donde}` : tipo
}

function aAlojamiento(f: FilaRental): Alojamiento {
  return {
    id: `pu-${f.id}`,
    origen: 'pereira-unida',
    titulo: tituloDe(f),
    descripcion: limpio(f.address),
    tipo: f.property_type?.trim() || 'Otro',
    ciudad: limpio(f.municipality) ?? 'Sin ciudad',
    departamento: limpio(f.department),
    barrio: limpio(f.neighborhood),
    direccion: limpio(f.address),
    precioMes: f.monthly_rent && f.monthly_rent > 0 ? f.monthly_rent : null,
    precioEnTexto: null,
    amoblado: f.furnished,
    habitaciones: null,
    banos: null,
    parqueaderos: null,
    areaM2: null,
    disponible: (f.status ?? 'disponible').toLowerCase().trim() === 'disponible',
    lat: f.lat,
    lng: f.lng,
    fotos: Array.isArray(f.photo_urls) ? f.photo_urls.filter(Boolean) : [],
    telefono: limpio(f.contact),
    contactos: null,
    publicadoEn: f.submitted_at ?? f.created_at,
  }
}

function aComentario(f: FilaComentario): ComentarioPeticion {
  return {
    id: f.id,
    peticionId: f.report_id,
    autor: limpio(f.author_name),
    texto: limpio(f.content) ?? '',
    creadoEn: f.created_at,
  }
}

export const pereiraUnida: Backend = {
  descripcion: {
    id: 'pereira-unida',
    nombre: 'Pereira Unida',
    tipo: 'Tablón de la comunidad',
    descripcion: 'Vecinos que piden ayuda y vecinos que se ofrecen, con su teléfono.',
    quienPublica: 'Cualquier persona, sin registrarse.',
    url: 'https://pereiraunida.com',
    capacidades: [
      'leer:peticiones-persona',
      'leer:ofrecimientos-persona',
      'leer:comentarios',
      'leer:alojamientos',
    ],
  },

  leer: {
    async peticionesPersona(): Promise<PeticionPersona[]> {
      const filas = await leer<FilaReporte>('reports', COLUMNAS_REPORTE, (q) =>
        (q as unknown as { order: (c: string, o: object) => unknown }).order('created_at', {
          ascending: false,
        }),
      )
      return filas.map(aPeticion)
    },

    async ofrecimientosPersona(): Promise<OfrecimientoPersona[]> {
      const filas = await leer<FilaOferta>('help_offers', COLUMNAS_OFERTA, (q) =>
        (q as unknown as { order: (c: string, o: object) => unknown }).order('created_at', {
          ascending: false,
        }),
      )
      return filas.map(aOfrecimiento)
    },

    async alojamientos(): Promise<Alojamiento[]> {
      const filas = await leer<FilaRental>('rentals', COLUMNAS_RENTAL, (q) =>
        (q as unknown as { order: (c: string, o: object) => unknown }).order('created_at', {
          ascending: false,
        }),
      )
      return filas.map(aAlojamiento)
    },

    async comentarios(): Promise<ComentarioPeticion[]> {
      const filas = await leer<FilaComentario>('comments', COLUMNAS_COMENTARIO)
      return filas.map(aComentario)
    },
  },

  escribir: {},
}

/* ------------------------------ Publicar ---------------------------------- */

/**
 * Vocabulario de Corag → vocabulario de este tablón.
 *
 * Publicar con una categoría que la fuente no usa deja la petición fuera de sus
 * propios filtros: la ve quien mire la lista entera y nadie más. Estas son las
 * nueve etiquetas que aparecen en sus 282 reportes, no las que nos gustaría.
 */
const CATEGORIA_DESDE_CORAG: Record<string, string> = {
  alimentos: 'alimentos',
  agua: 'alimentos',
  salud: 'medicinas',
  medicamentos: 'medicinas',
  herramientas: 'herramientas',
  rescate: 'herramientas_rescate',
  transporte: 'transporte_logistica',
  acopio: 'voluntariado',
  voluntariado: 'voluntariado',
  mascotas: 'mascotas',
  refugio: 'otros',
  otro: 'otros',
}

export interface BorradorReporte {
  titulo: string
  descripcion: string
  /** Categoría en el vocabulario de Corag; aquí se traduce. */
  categoria: string
  urgente: boolean
  municipio: string
  departamento: string
  lugar: string
  lat: number | null
  lng: number | null
  telefono: string
}

/**
 * Publica la misma petición también en este tablón.
 *
 * Es una escritura de mejor esfuerzo: quien la llama ya publicó en Corag y esto
 * solo amplía el alcance. Si falla —la clave pública podría no tener permiso de
 * inserción, cosa que no hemos comprobado porque exigía escribir en una base de
 * producción ajena— la petición original sigue publicada, y eso es lo que se le
 * cuenta a la persona.
 */
export async function publicarReporte(b: BorradorReporte): Promise<void> {
  if (configuracionIncompleta) {
    throw new ErrorApp({
      mensaje: 'La aplicación no está bien configurada.',
      sugerencia: 'Avisa a soporte con este código.',
      codigo: 'PU-CFG0',
      reintentable: false,
    })
  }

  const { error } = await cliente.from('reports').insert({
    title: b.titulo.trim(),
    description: b.descripcion.trim() || '',
    category: CATEGORIA_DESDE_CORAG[b.categoria] ?? 'otros',
    urgent_level: b.urgente ? 'critico' : 'moderado',
    status: 'buscando',
    municipality: b.municipio.trim() || null,
    department: b.departamento.trim() || null,
    location_name: b.lugar.trim() || null,
    lat: b.lat,
    lng: b.lng,
    contact_phone: b.telefono.replace(/\D/g, ''),
    photo_urls: [],
  } as never)

  if (error) throw new ErrorApp(traducirError(error, 'PU'), error)
}
