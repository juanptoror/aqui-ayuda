import { useMemo } from 'react'
import { useCentros, useInventario, useMunicipios, useNecesidades, useTransportes } from './consultas'
import { useSesion } from '@/state/sesion'
import type { ResumenCategoria, Transporte } from '@/dominio/modelos'

/**
 * Inventario de un municipio agrupado por categoría, con DÓNDE está cada cosa.
 *
 * Es la pregunta que no podía responderse antes: "hay agua, ¿pero dónde?".
 * Junta existencias y pedidos de la misma categoría para que se vea de un
 * vistazo si algo sobra en un centro y falta en el de al lado — que es el
 * problema real de coordinación en una emergencia.
 */
export function useInventarioCiudad(slug: string | undefined) {
  const { sesion } = useSesion()
  const qCiudades = useMunicipios()
  const qCentros = useCentros(!!sesion)
  const qInventario = useInventario()
  const qNecesidades = useNecesidades()

  return useMemo(() => {
    const cargando =
      qCiudades.isLoading || qCentros.isLoading || qInventario.isLoading || qNecesidades.isLoading

    const ciudad = slug ? ((qCiudades.data ?? []).find((c) => c.slug === slug) ?? null) : null

    const centros = ciudad
      ? (qCentros.data ?? []).filter((c) => c.ciudadId === ciudad.id)
      : []
    const porId = new Map(centros.map((c) => [c.id, c]))

    const existencias = (qInventario.data ?? []).filter(
      (i) => porId.has(i.centroId) && i.cantidad > 0,
    )
    const pedidos = (qNecesidades.data ?? []).filter(
      (n) => porId.has(n.centroId) && n.estado === 'pendiente',
    )

    const categorias = [
      ...new Set([...existencias.map((i) => i.categoria), ...pedidos.map((n) => n.categoria)]),
    ]

    const resumen: ResumenCategoria[] = categorias
      .map((categoria) => {
        const deCategoria = existencias.filter((i) => i.categoria === categoria)

        // No se pueden sumar cajas con kits: se totaliza por unidad.
        const porUnidad = new Map<string, number>()
        for (const i of deCategoria) {
          porUnidad.set(i.unidad, (porUnidad.get(i.unidad) ?? 0) + i.cantidad)
        }

        return {
          categoria,
          totalesPorUnidad: [...porUnidad.entries()]
            .map(([unidad, cantidad]) => ({ unidad, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad),
          disponibleEn: deCategoria
            .map((i) => {
              const c = porId.get(i.centroId)!
              return {
                centroId: i.centroId,
                centroNombre: c.nombre,
                centroAbierto: c.abierto,
                cantidad: i.cantidad,
                unidad: i.unidad,
                actualizadoEn: i.actualizadoEn,
              }
            })
            .sort((a, b) => b.cantidad - a.cantidad),
          solicitadaEn: pedidos
            .filter((n) => n.categoria === categoria)
            .map((n) => {
              const c = porId.get(n.centroId)!
              return {
                centroId: n.centroId,
                centroNombre: c.nombre,
                centroAbierto: c.abierto,
                prioridad: n.prioridad,
                descripcion: n.descripcion,
              }
            })
            .sort((a, b) => peso(b.prioridad) - peso(a.prioridad)),
        }
      })
      // Primero lo que más se pide: es lo que hay que resolver.
      .sort((a, b) => b.solicitadaEn.length - a.solicitadaEn.length)

    return {
      cargando,
      error: qCiudades.error ?? qCentros.error ?? null,
      ciudad,
      centros,
      resumen,
    }
  }, [
    slug,
    qCiudades.data,
    qCiudades.error,
    qCiudades.isLoading,
    qCentros.data,
    qCentros.error,
    qCentros.isLoading,
    qInventario.data,
    qInventario.isLoading,
    qNecesidades.data,
    qNecesidades.isLoading,
  ])
}

/** Transportes del municipio, con los nombres de origen y destino resueltos. */
export interface TransporteVista extends Transporte {
  origenNombre: string
  destinoNombre: string
}

export function useTransportesCiudad(ciudadId: string | undefined) {
  const { sesion } = useSesion()
  const qTransportes = useTransportes()
  const qCentros = useCentros(!!sesion)

  return useMemo(() => {
    const porId = new Map((qCentros.data ?? []).map((c) => [c.id, c.nombre]))

    const lista: TransporteVista[] = (qTransportes.data ?? [])
      .filter((t) => !ciudadId || t.ciudadId === ciudadId)
      .map((t) => ({
        ...t,
        origenNombre: (t.origenId && porId.get(t.origenId)) || 'Origen sin registrar',
        destinoNombre:
          (t.destinoId && porId.get(t.destinoId)) || t.destinoTexto || 'Destino sin registrar',
      }))
      // Los que aún no han salido primero: son sobre los que se puede actuar.
      .sort((a, b) => {
        const activo = (e: string) => (e === 'programado' || e === 'en_ruta' ? 0 : 1)
        if (activo(a.estado) !== activo(b.estado)) return activo(a.estado) - activo(b.estado)
        return (b.salida ?? b.creadoEn).localeCompare(a.salida ?? a.creadoEn)
      })

    return {
      cargando: qTransportes.isLoading || qCentros.isLoading,
      error: qTransportes.error ?? null,
      transportes: lista,
    }
  }, [ciudadId, qTransportes.data, qTransportes.error, qTransportes.isLoading, qCentros.data, qCentros.isLoading])
}

function peso(p: string): number {
  return p === 'urgente' ? 3 : p === 'alta' ? 2 : 1
}
