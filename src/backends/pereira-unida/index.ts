import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Backend } from '@/backends/contrato'
import type {
  ComentarioPeticion,
  OfrecimientoPersona,
  PeticionPersona,
} from '@/dominio/modelos'
import { ErrorApp, traducirError } from '@/lib/errores'
import {
  COLUMNAS_COMENTARIO,
  COLUMNAS_OFERTA,
  COLUMNAS_REPORTE,
  type FilaComentario,
  type FilaOferta,
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
    capacidades: ['leer:peticiones-persona', 'leer:ofrecimientos-persona', 'leer:comentarios'],
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

    async comentarios(): Promise<ComentarioPeticion[]> {
      const filas = await leer<FilaComentario>('comments', COLUMNAS_COMENTARIO)
      return filas.map(aComentario)
    },
  },

  escribir: {},
}
