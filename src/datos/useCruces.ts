import { useMemo } from 'react'
import { useCentros, useInventario, useOfrecimientosPersona } from './consultas'
import { useSesion } from '@/state/sesion'
import { usePreferencias } from '@/state/preferencias'
import { distanciaKm } from '@/lib/geo'
import { comparar, esServicio, type Precision } from '@/dominio/taxonomia'
import { useAyudas, enlaceWhatsapp, LIMITE_MAX, type AyudaCorag } from '@/backends/corag'
import type { Coordenada, Necesidad } from '@/dominio/modelos'
import type { Origen } from '@/components/Fuente'

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

/* ------------------------- El cruce en el otro sentido --------------------- */

/**
 * Para lo que pide un centro, quién lo tiene o lo ofrece.
 *
 * `useCrucesConCentros` contesta "esta persona pide algo, ¿hay un centro que lo
 * tenga?". Esto contesta lo contrario, que es la pregunta de quien coordina un
 * centro de acopio: **"me falta agua, ¿quién tiene agua?"**. Sin esto, cada
 * centro miraba su lista de faltantes sin saber que a ochocientos metros hay
 * otro con dieciocho cajas de lo mismo, y que dos vecinos lo están ofreciendo
 * con su teléfono puesto. Los datos estaban los tres cargados; lo que no había
 * era quien los mirase juntos.
 *
 * Tres fuentes, y NO dicen lo mismo:
 *
 * - Un centro con inventario **lo tiene**: hay una cantidad contada en una
 *   bodega y se puede ir a por ella.
 * - Una persona **lo ofrece**: es una intención, no una existencia. Se marca
 *   distinto a propósito, porque tratar un ofrecimiento como stock hace que un
 *   coordinador tache una urgencia que sigue sin cubrir.
 * - Y un servicio no se cruza contra inventario, como en el resto de la app:
 *   nadie guarda cajas de voluntariado.
 */
export type TipoTenedor = 'centro' | 'persona'

export interface QuienLoTiene {
  id: string
  origen: Origen
  tipo: TipoTenedor
  nombre: string
  detalle: string | null
  /** Solo los centros cuentan existencias. Una persona ofrece, no inventaría. */
  cantidad: number | null
  unidad: string | null
  /** Solo los centros abren y cierran. */
  abierto: boolean | null
  distanciaKm: number | null
  precision: Precision
  telefono: string | null
  whatsapp: string | null
  enlaceInterno: string | null
  /** Para abrir el mapa en el punto exacto y no en una dirección buscada. */
  lat: number | null
  lng: number | null
}

export interface CruceNecesidad {
  /** Ordenados: exacto antes que aproximado, existencias antes que intenciones. */
  todos: QuienLoTiene[]
  hayExacto: boolean
  /** Cuántos de los de arriba son existencias contadas y no ofrecimientos. */
  conStock: number
}

/**
 * @param necesidades Las que están pendientes; las cubiertas no se cruzan.
 * @param desde Coordenada del centro que pide, para medir a quién le pilla cerca.
 * @param excluirCentroId El propio centro: encontrarse a uno mismo no informa.
 */
export function useQuienLoTiene(
  necesidades: Necesidad[],
  desde: Coordenada | null,
  excluirCentroId: string | null,
): Map<string, CruceNecesidad> {
  const { sesion } = useSesion()
  const { ubicacion } = usePreferencias()
  const qCentros = useCentros(!!sesion)
  const qInventario = useInventario()
  const qOfertasCorag = useAyudas({
    tipo: 'offer',
    ubicacion,
    radioKm: 150,
    limite: LIMITE_MAX,
  })
  const qOfrecenVecinos = useOfrecimientosPersona()

  return useMemo(() => {
    const cruces = new Map<string, CruceNecesidad>()
    const centros = qCentros.data ?? []
    const porId = new Map(centros.map((c) => [c.id, c]))
    const inventario = (qInventario.data ?? []).filter(
      (i) => i.cantidad > 0 && i.centroId !== excluirCentroId,
    )

    const dist = (lat: number | null, lng: number | null) =>
      desde && lat != null && lng != null ? distanciaKm(desde, { lat, lng }) : null

    for (const n of necesidades) {
      if (n.estado === 'cubierta') continue
      const encontrados: QuienLoTiene[] = []

      // 1. Otros centros con existencias. Lo más resolutivo: hay dónde ir.
      if (!esServicio(n.categoria, 'ayudas-pereira')) {
        for (const item of inventario) {
          const precision = comparar(n.categoria, 'ayudas-pereira', item.categoria, 'ayudas-pereira')
          if (precision === 'ninguna') continue
          const c = porId.get(item.centroId)
          if (!c) continue
          encontrados.push({
            id: `ap-${item.id}`,
            origen: 'ayudas-pereira',
            tipo: 'centro',
            nombre: c.nombre,
            detalle: c.direccion,
            cantidad: item.cantidad,
            unidad: item.unidad,
            abierto: c.abierto,
            distanciaKm: dist(c.lat, c.lng),
            precision,
            telefono: c.telefono ?? null,
            whatsapp: null,
            enlaceInterno: `/centro/${c.id}`,
            lat: c.lat,
            lng: c.lng,
          })
        }
      }

      // 2. Personas que lo ofrecen en Corag, con WhatsApp.
      for (const o of qOfertasCorag.data?.items ?? []) {
        const precision = comparar(n.categoria, 'ayudas-pereira', o.category, 'corag')
        if (precision === 'ninguna') continue
        encontrados.push({
          id: `cg-${o.id}`,
          origen: 'corag',
          tipo: 'persona',
          nombre: o.title,
          detalle: o.description ?? o.location?.neighborhood ?? null,
          cantidad: null,
          unidad: null,
          abierto: null,
          distanciaKm: dist(o.location?.latitude ?? null, o.location?.longitude ?? null),
          precision,
          telefono: o.contact?.whatsapp ?? null,
          whatsapp: enlaceWhatsapp(o.contact?.whatsapp ?? null, o.title),
          enlaceInterno: null,
          lat: o.location?.latitude ?? null,
          lng: o.location?.longitude ?? null,
        })
      }

      /* 3. Vecinos del tablón que se ofrecen. Aquí no hay coordenada: la fuente
            no la guarda en los ofrecimientos, así que van sin distancia en vez
            de con una inventada. */
      for (const v of qOfrecenVecinos.data ?? []) {
        const precision = comparar(n.categoria, 'ayudas-pereira', v.habilidad, 'pereira-unida')
        if (precision === 'ninguna') continue
        const tel = v.telefono?.replace(/\D/g, '') ?? ''
        encontrados.push({
          id: `pu-${v.id}`,
          origen: 'pereira-unida',
          tipo: 'persona',
          nombre: v.nombre,
          detalle:
            v.descripcion ?? ([v.municipio, v.departamento].filter(Boolean).join(', ') || null),
          cantidad: null,
          unidad: null,
          abierto: null,
          distanciaKm: null,
          precision,
          telefono: v.telefono,
          whatsapp:
            tel.length >= 10
              ? `https://wa.me/${tel.startsWith('57') ? tel : `57${tel}`}?text=${encodeURIComponent(
                  `Hola, en AquíAyuda vi que ofreces ayuda. Estamos pidiendo ${n.categoria.toLowerCase()}.`,
                )}`
              : null,
          enlaceInterno: null,
          lat: null,
          lng: null,
        })
      }

      if (encontrados.length === 0) continue

      encontrados.sort((a, b) => {
        // Lo que encaja justo antes que lo de la misma familia.
        if (a.precision !== b.precision) return a.precision === 'exacta' ? -1 : 1
        // Una caja contada resuelve más que una buena intención.
        if (a.tipo !== b.tipo) return a.tipo === 'centro' ? -1 : 1
        if (a.abierto !== b.abierto && a.tipo === 'centro') return a.abierto ? -1 : 1
        if (a.distanciaKm != null && b.distanciaKm != null) return a.distanciaKm - b.distanciaKm
        if (a.distanciaKm != null) return -1
        if (b.distanciaKm != null) return 1
        return (b.cantidad ?? 0) - (a.cantidad ?? 0)
      })

      cruces.set(n.id, {
        todos: encontrados,
        hayExacto: encontrados.some((e) => e.precision === 'exacta'),
        conStock: encontrados.filter((e) => e.tipo === 'centro').length,
      })
    }

    return cruces
  }, [
    necesidades,
    desde,
    excluirCentroId,
    qCentros.data,
    qInventario.data,
    qOfertasCorag.data,
    qOfrecenVecinos.data,
  ])
}
