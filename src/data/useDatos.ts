import { useMemo } from 'react'
import { useCentros, useCiudades, useInventario, useNecesidades } from './queries'
import { useSesion } from '@/state/sesion'
import { coordenadaDeCiudad, distanciaKm } from '@/lib/geo'
import type { CentroVista, Ciudad, Coordenada, Necesidad } from '@/types'

export interface ResumenCiudad {
  centros: number
  abiertos: number
  urgentes: number
  pendientes: number
  categoriasFaltantes: number
  actualizado: string | null
}

export interface DatosCiudad {
  cargando: boolean
  error: Error | null
  ciudad: Ciudad | null
  /** Slug destino cuando la ciudad pedida fue fusionada en otra. */
  redirigirA: string | null
  /** true cuando el slug no existe en el catálogo. */
  noEncontrada: boolean
  centros: CentroVista[]
  resumen: ResumenCiudad
  categoriasUrgentes: { categoria: string; total: number }[]
}

/** Ciudades listables, con su distancia al usuario si se conoce. */
export interface CiudadCercana extends Ciudad {
  distanciaKm: number | null
}

export function useCiudadesCercanas(ubicacion: Coordenada | null) {
  const q = useCiudades()

  const ciudades = useMemo<CiudadCercana[]>(() => {
    const listables = (q.data ?? []).filter((c) => c.activa && c.fusionada_en === null)

    const conDistancia = listables.map((c) => {
      const coord = coordenadaDeCiudad(c.slug)
      return {
        ...c,
        distanciaKm: ubicacion && coord ? distanciaKm(ubicacion, coord) : null,
      }
    })

    // Sin ubicación, orden alfabético. Con ubicación, por cercanía; las que no
    // tienen coordenada conocida van al final en vez de fingir estar cerca.
    if (!ubicacion) {
      return conDistancia.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }
    return conDistancia.sort((a, b) => {
      if (a.distanciaKm == null && b.distanciaKm == null) {
        return a.nombre.localeCompare(b.nombre, 'es')
      }
      if (a.distanciaKm == null) return 1
      if (b.distanciaKm == null) return -1
      return a.distanciaKm - b.distanciaKm
    })
  }, [q.data, ubicacion])

  return { ciudades, cargando: q.isLoading, error: q.error as Error | null, refetch: q.refetch }
}

export function useDatosCiudad(slug: string | undefined, ubicacion: Coordenada | null): DatosCiudad {
  const { sesion } = useSesion()
  const qCiudades = useCiudades()
  const qCentros = useCentros(!!sesion)
  const qNecesidades = useNecesidades()
  const qInventario = useInventario()

  return useMemo(() => {
    const cargando =
      qCiudades.isLoading || qCentros.isLoading || qNecesidades.isLoading || qInventario.isLoading

    const ciudades = qCiudades.data ?? []
    const ciudad = slug ? (ciudades.find((c) => c.slug === slug) ?? null) : null

    // Ciudad fusionada en otra: se resuelve el destino para redirigir en vez de
    // mostrar una pantalla vacía sin explicación.
    let redirigirA: string | null = null
    if (ciudad && ciudad.fusionada_en) {
      redirigirA = ciudades.find((c) => c.id === ciudad.fusionada_en)?.slug ?? null
    }

    const noEncontrada = !!slug && !cargando && ciudades.length > 0 && !ciudad

    const centrosBase = ciudad
      ? (qCentros.data ?? []).filter((c) => c.ciudad_id === ciudad.id)
      : []

    const ids = new Set(centrosBase.map((c) => c.id))
    const necesidades = (qNecesidades.data ?? []).filter((n) => ids.has(n.centro_id))
    const inventario = (qInventario.data ?? []).filter((i) => ids.has(i.centro_id))

    const porCentroNec = agrupar(necesidades, (n) => n.centro_id)
    const porCentroInv = agrupar(inventario, (i) => i.centro_id)

    const centros: CentroVista[] = centrosBase
      .map((c) => {
        const necs = porCentroNec.get(c.id) ?? []
        const pendientes = necs.filter((n) => n.estado === 'pendiente')
        return {
          ...c,
          // Los nombres y direcciones vienen con espacios sobrantes del
          // formulario de captura; se limpian aquí y no en cada vista.
          nombre: c.nombre?.trim() || 'Centro sin nombre',
          direccion: c.direccion?.trim() || null,
          responsable: c.responsable?.trim() || null,
          notas: c.notas?.trim() || null,
          necesidades: necs,
          inventario: porCentroInv.get(c.id) ?? [],
          urgentes: pendientes.filter((n) => n.prioridad === 'urgente').length,
          pendientes: pendientes.length,
          distanciaKm:
            ubicacion && c.lat != null && c.lng != null
              ? distanciaKm(ubicacion, { lat: c.lat, lng: c.lng })
              : null,
        }
      })
      // Orden: los abiertos primero (ir a uno cerrado es un viaje perdido),
      // luego por cercanía, y a igualdad por urgencia.
      .sort((a, b) => {
        if (a.abierto !== b.abierto) return a.abierto ? -1 : 1
        if (a.distanciaKm != null && b.distanciaKm != null) return a.distanciaKm - b.distanciaKm
        if (a.distanciaKm != null) return -1
        if (b.distanciaKm != null) return 1
        if (b.urgentes !== a.urgentes) return b.urgentes - a.urgentes
        return a.nombre.localeCompare(b.nombre, 'es')
      })

    const pendientesTotales = necesidades.filter((n) => n.estado === 'pendiente')

    const porCategoria = new Map<string, number>()
    for (const n of pendientesTotales) {
      if (n.prioridad === 'urgente' || n.prioridad === 'alta') {
        porCategoria.set(n.categoria, (porCategoria.get(n.categoria) ?? 0) + 1)
      }
    }

    const categoriasUrgentes = [...porCategoria.entries()]
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total)

    const fechas = [
      ...necesidades.map((n) => n.created_at),
      ...inventario.map((i) => i.updated_at),
    ].filter(Boolean)

    const resumen: ResumenCiudad = {
      centros: centros.length,
      abiertos: centros.filter((c) => c.abierto).length,
      urgentes: pendientesTotales.filter((n) => n.prioridad === 'urgente').length,
      pendientes: pendientesTotales.length,
      categoriasFaltantes: new Set(pendientesTotales.map((n) => n.categoria)).size,
      actualizado: fechas.length ? fechas.sort()[fechas.length - 1] : null,
    }

    const errorDuro =
      (qCiudades.error as Error | null) ?? (qCentros.error as Error | null) ?? null

    return {
      cargando,
      error: errorDuro,
      ciudad,
      redirigirA,
      noEncontrada,
      centros,
      resumen,
      categoriasUrgentes,
    }
  }, [
    slug,
    ubicacion,
    qCiudades.data,
    qCiudades.error,
    qCiudades.isLoading,
    qCentros.data,
    qCentros.error,
    qCentros.isLoading,
    qNecesidades.data,
    qNecesidades.isLoading,
    qInventario.data,
    qInventario.isLoading,
  ])
}

function agrupar<T>(items: T[], clave: (item: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>()
  for (const item of items) {
    const k = clave(item)
    const actual = mapa.get(k)
    if (actual) actual.push(item)
    else mapa.set(k, [item])
  }
  return mapa
}

export function categoriasPresentes(necesidades: Necesidad[]): string[] {
  return [...new Set(necesidades.map((n) => n.categoria))]
}
