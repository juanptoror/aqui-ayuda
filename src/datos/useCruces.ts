import { useMemo } from 'react'
import { useCentros, useInventario } from './consultas'
import { useSesion } from '@/state/sesion'
import { distanciaKm } from '@/lib/geo'
import { comparar, esServicio, type Precision } from '@/dominio/taxonomia'
import type { AyudaCorag } from '@/backends/corag'

/**
 * El cruce entre los dos backends.
 *
 * Hoy hay cientos de personas pidiendo cosas en Corag y decenas de centros con
 * inventario en Ayudas Pereira, y nadie los conecta: son dos bases de datos que
 * no se hablan. Esto responde, para cada petición, "¿esto que pides está cerca?".
 *
 * No promete de más: distingue el acierto exacto (misma subcategoría) del
 * aproximado (misma familia), y no cruza servicios —nadie guarda "cajas de
 * voluntariado" en una bodega—.
 */

export interface CentroConLoQuePides {
  centroId: string
  centroNombre: string
  abierto: boolean
  distanciaKm: number | null
  cantidad: number
  unidad: string
  precision: Precision
}

export interface CruceAyuda {
  /** Ordenados: primero exactos, luego por cercanía. */
  centros: CentroConLoQuePides[]
  hayExacto: boolean
}

export function useCrucesConCentros(ayudas: AyudaCorag[]): Map<string, CruceAyuda> {
  const { sesion } = useSesion()
  const qCentros = useCentros(!!sesion)
  const qInventario = useInventario()

  return useMemo(() => {
    const centros = qCentros.data ?? []
    const inventario = (qInventario.data ?? []).filter((i) => i.cantidad > 0)
    const porId = new Map(centros.map((c) => [c.id, c]))
    const cruces = new Map<string, CruceAyuda>()

    if (centros.length === 0 || inventario.length === 0) return cruces

    for (const ayuda of ayudas) {
      // Pedir transporte o voluntarios no se resuelve con inventario.
      if (esServicio(ayuda.category, 'corag')) continue

      const coord =
        ayuda.location?.latitude != null && ayuda.location?.longitude != null
          ? { lat: ayuda.location.latitude, lng: ayuda.location.longitude }
          : null

      const encontrados: CentroConLoQuePides[] = []

      for (const item of inventario) {
        const precision = comparar(ayuda.category, 'corag', item.categoria, 'ayudas-pereira')
        if (precision === 'ninguna') continue

        const centro = porId.get(item.centroId)
        if (!centro) continue

        encontrados.push({
          centroId: centro.id,
          centroNombre: centro.nombre,
          abierto: centro.abierto,
          distanciaKm:
            coord && centro.lat != null && centro.lng != null
              ? distanciaKm(coord, { lat: centro.lat, lng: centro.lng })
              : null,
          cantidad: item.cantidad,
          unidad: item.unidad,
          precision,
        })
      }

      if (encontrados.length === 0) continue

      encontrados.sort((a, b) => {
        // Un acierto exacto vale más que uno cercano pero aproximado.
        if (a.precision !== b.precision) return a.precision === 'exacta' ? -1 : 1
        if (a.abierto !== b.abierto) return a.abierto ? -1 : 1
        if (a.distanciaKm != null && b.distanciaKm != null) return a.distanciaKm - b.distanciaKm
        if (a.distanciaKm != null) return -1
        if (b.distanciaKm != null) return 1
        return b.cantidad - a.cantidad
      })

      cruces.set(ayuda.id, {
        centros: encontrados.slice(0, 4),
        hayExacto: encontrados.some((c) => c.precision === 'exacta'),
      })
    }

    return cruces
  }, [ayudas, qCentros.data, qInventario.data])
}
