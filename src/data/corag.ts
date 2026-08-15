import { useMutation, useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { Coordenada } from '@/types'

/**
 * Segunda fuente de datos: la API pública de Corag (ayuda.corag.app).
 *
 * Cubre algo que Supabase no tiene: peticiones y ofrecimientos de PERSONAS
 * concretas, geolocalizados y con WhatsApp. Supabase tiene los centros de
 * acopio (organizaciones); Corag tiene la ayuda directa entre vecinos. Las dos
 * conviven sin mezclarse: cada pantalla dice de dónde viene lo que muestra.
 *
 * Tres rasgos de esta API que condicionan el código:
 * 1. No hay autenticación. Publicar es un POST directo.
 * 2. Es idempotente por `source` + `externalId`: reintentar la misma
 *    publicación no duplica. Por eso el identificador se genera UNA vez por
 *    formulario y se reutiliza en los reintentos.
 * 3. El teléfono solo se publica con `publishContact: true`, que exige que la
 *    persona haya aceptado explícitamente. En la interfaz es una casilla que
 *    nadie marca por ti.
 */

const BASE = 'https://ayuda.corag.app/api/public/v1/help'

export type TipoAyuda = 'request' | 'offer'
export type Urgencia = 'urgent' | 'needed' | 'stable'

/** Categorías admitidas al PUBLICAR (la lectura devuelve más variedad). */
export const CATEGORIAS_CORAG = [
  'alimentos',
  'salud',
  'refugio',
  'transporte',
  'acopio',
  'rescate',
  'otro',
] as const

export type CategoriaCorag = (typeof CATEGORIAS_CORAG)[number]

export interface Emergencia {
  slug: string
  title: string
  summary?: string
  location?: string
  occurred_on?: string
}

export interface Cantidades {
  required: number
  committed: number
  received: number
  pendingToCommit: number
  pendingToDeliver: number
  coveragePercentage: number
  status: string
}

export interface AyudaCorag {
  id: string
  type: TipoAyuda
  emergency: { slug: string; title: string } | null
  title: string
  description: string | null
  category: string
  urgency: Urgencia | null
  status: string
  operationalStatus: string | null
  priorityScore: number | null
  location: {
    address: string | null
    neighborhood: string | null
    latitude: number | null
    longitude: number | null
    distanceKm: number | null
  } | null
  contact: { name: string | null; whatsapp: string | null; contactCount: number } | null
  quantities: Cantidades | null
  verification: { confirmationCount: number; lastConfirmedAt: string | null } | null
  collectionCenter: { status?: string } | null
  createdAt: string
  publicUrl: string | null
}

interface RespuestaLista {
  generatedAt: string
  total: number
  returned: number
  items: AyudaCorag[]
}

interface RespuestaRaiz {
  name: string
  version: string
  emergencies: Emergencia[]
}

async function pedir<T>(url: string, senal?: AbortSignal): Promise<T> {
  const r = await fetch(url, {
    signal: senal,
    headers: { Accept: 'application/json' },
  })
  if (!r.ok) {
    throw new Error(`La API de Corag respondió ${r.status}.`)
  }
  return (await r.json()) as T
}

/** Emergencias activas. `emergencySlug` es obligatorio al publicar si hay más de una. */
export function useEmergencias(): UseQueryResult<Emergencia[]> {
  return useQuery({
    queryKey: ['corag', 'emergencias'],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const r = await pedir<RespuestaRaiz>(BASE, signal)
      return r.emergencies ?? []
    },
  })
}

export interface FiltrosAyuda {
  tipo: TipoAyuda | 'all'
  /** Con ubicación, la API filtra por radio y calcula la distancia real. */
  ubicacion: Coordenada | null
  radioKm: number
  limite: number
}

export function useAyudas(filtros: FiltrosAyuda): UseQueryResult<RespuestaLista> {
  const { tipo, ubicacion, radioKm, limite } = filtros

  return useQuery({
    queryKey: ['corag', 'ayudas', tipo, ubicacion?.lat ?? null, ubicacion?.lng ?? null, radioKm, limite],
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const p = new URLSearchParams({
        view: 'list',
        status: 'active',
        limit: String(limite),
      })
      if (tipo !== 'all') p.set('type', tipo)
      if (ubicacion) {
        p.set('latitude', String(ubicacion.lat))
        p.set('longitude', String(ubicacion.lng))
        p.set('radiusKm', String(radioKm))
      }
      return pedir<RespuestaLista>(`${BASE}?${p.toString()}`, signal)
    },
  })
}

/* --------------------------------- Publicar -------------------------------- */

export interface BorradorAyuda {
  type: TipoAyuda
  title: string
  description?: string
  category: CategoriaCorag
  contactName: string
  contactWhatsapp: string
  /** Debe ser una decisión explícita de la persona. Nunca se asume. */
  publishContact: boolean
  emergencySlug?: string
  /** Obligatorios para una solicitud. */
  address?: string
  latitude?: number
  longitude?: number
  urgency?: Urgencia
  neededPeople?: number
}

/**
 * Identificador estable por formulario. La API deduplica con `source` +
 * `externalId`, así que reintentar tras un fallo de red reenvía el MISMO id y
 * no crea un duplicado. Generarlo en cada envío anularía esa garantía.
 */
export function nuevoExternalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `ac-${crypto.randomUUID()}`
  }
  return `ac-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const FUENTE = 'ayudas-colombia'

export function usePublicarAyuda() {
  return useMutation({
    mutationFn: async ({
      borrador,
      externalId,
    }: {
      borrador: BorradorAyuda
      externalId: string
    }) => {
      if (!borrador.publishContact) {
        throw new Error(
          'Falta el permiso para publicar el contacto. Sin él no se puede enviar.',
        )
      }

      const cuerpo: Record<string, unknown> = {
        source: FUENTE,
        externalId,
        type: borrador.type,
        title: borrador.title.trim(),
        category: borrador.category,
        contactName: borrador.contactName.trim(),
        contactWhatsapp: borrador.contactWhatsapp.trim(),
        publishContact: true,
      }

      if (borrador.description?.trim()) cuerpo.description = borrador.description.trim()
      if (borrador.emergencySlug) cuerpo.emergencySlug = borrador.emergencySlug

      if (borrador.type === 'request') {
        cuerpo.address = borrador.address?.trim()
        cuerpo.latitude = borrador.latitude
        cuerpo.longitude = borrador.longitude
        cuerpo.urgency = borrador.urgency ?? 'needed'
        if (borrador.neededPeople != null) cuerpo.neededPeople = borrador.neededPeople
      }

      const r = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(cuerpo),
      })

      const texto = await r.text()
      if (!r.ok) {
        // El cuerpo de error suele traer el detalle de validación: se muestra
        // tal cual en vez de un "algo salió mal" genérico.
        let detalle = texto
        try {
          const j = JSON.parse(texto)
          detalle = j.message ?? j.error ?? texto
        } catch {
          /* la respuesta no era JSON */
        }
        throw new Error(`No se pudo publicar (${r.status}): ${detalle}`)
      }

      return texto ? JSON.parse(texto) : {}
    },
  })
}

/** Enlace directo de WhatsApp con un mensaje que ya explica de dónde sale. */
export function enlaceWhatsapp(numero: string | null, titulo: string): string | null {
  if (!numero) return null
  const limpio = numero.replace(/[^\d]/g, '')
  if (limpio.length < 8) return null
  const texto = encodeURIComponent(
    `Hola, vi tu publicación "${titulo}" en AquíAyuda y quiero ayudar.`,
  )
  return `https://wa.me/${limpio}?text=${texto}`
}
