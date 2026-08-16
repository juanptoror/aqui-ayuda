import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { backendPrincipalPara, backendsCon } from '@/backends/registro'
import type {
  BorradorOfrecimiento,
  BorradorTransporte,
  BorradorVehiculo,
  BorradorVoluntario,
} from '@/backends/contrato'
import { ErrorApp, mensajeDe } from '@/lib/errores'
import type {
  Afectacion,
  Centro,
  Ciudad,
  ItemInventario,
  ComentarioPeticion,
  Necesidad,
  Alojamiento,
  OfrecimientoPersona,
  PeticionPersona,
  Transporte,
  TransporteItem,
  Vehiculo,
  Voluntario,
} from '@/dominio/modelos'

/**
 * Consultas de la app. No importan ningún backend por su nombre: piden al
 * registro quien sepa hacer cada cosa. Añadir un proveedor no toca este fichero.
 */

/** Un error ya traducido no se reintenta si es permanente. */
function reintentar(intentos: number, error: Error): boolean {
  if (error instanceof ErrorApp) return error.paraElUsuario.reintentable && intentos < 2
  return intentos < 2
}

const BASE = {
  staleTime: 60_000,
  gcTime: 10 * 60_000,
  retry: reintentar,
  refetchOnWindowFocus: false,
} as const

function faltaProveedor(que: string): never {
  throw new ErrorApp({
    mensaje: `Ahora mismo no hay ninguna fuente de ${que}.`,
    sugerencia: 'Vuelve a intentarlo más tarde.',
    codigo: 'APP-SRC0',
    reintentable: false,
  })
}

export function useMunicipios(): UseQueryResult<Ciudad[]> {
  return useQuery({
    queryKey: ['municipios'],
    ...BASE,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const b = backendPrincipalPara('leer:municipios')
      if (!b?.leer.municipios) faltaProveedor('municipios')
      return b.leer.municipios()
    },
  })
}

export function useCentros(conSesion: boolean): UseQueryResult<Centro[]> {
  return useQuery({
    queryKey: ['centros', conSesion],
    ...BASE,
    queryFn: async () => {
      const b = backendPrincipalPara('leer:centros')
      if (!b?.leer.centros) faltaProveedor('centros de acopio')
      return b.leer.centros(conSesion)
    },
  })
}

export function useNecesidades(): UseQueryResult<Necesidad[]> {
  return useQuery({
    queryKey: ['necesidades'],
    ...BASE,
    queryFn: async () => {
      const b = backendPrincipalPara('leer:necesidades')
      if (!b?.leer.necesidades) faltaProveedor('necesidades')
      return b.leer.necesidades()
    },
  })
}

export function useInventario(): UseQueryResult<ItemInventario[]> {
  return useQuery({
    queryKey: ['inventario'],
    ...BASE,
    queryFn: async () => {
      const b = backendPrincipalPara('leer:inventario')
      if (!b?.leer.inventario) faltaProveedor('inventario')
      return b.leer.inventario()
    },
  })
}

export function useTransportes(): UseQueryResult<Transporte[]> {
  return useQuery({
    queryKey: ['transportes'],
    ...BASE,
    queryFn: async () => {
      const b = backendPrincipalPara('leer:transportes')
      if (!b?.leer.transportes) faltaProveedor('transportes')
      return b.leer.transportes()
    },
  })
}

export function useTransporteItems(): UseQueryResult<TransporteItem[]> {
  return useQuery({
    queryKey: ['transporte-items'],
    ...BASE,
    queryFn: async () => {
      const b = backendPrincipalPara('leer:transporte-items')
      if (!b?.leer.transporteItems) faltaProveedor('el contenido de los transportes')
      return b.leer.transporteItems()
    },
  })
}

/**
 * Personas pidiendo ayuda en el tablon de la comunidad.
 *
 * Se filtran aqui, y no en la pantalla, los estados que NO deben publicarse:
 * la fuente marca 12 reportes como `informacion_falsa` y 10 como `duplicado`.
 * Republicar un aviso señalado como falso en plena emergencia es hacer daño, y
 * dejar los duplicados manda a dos personas al mismo sitio a lo mismo.
 */
const ESTADOS_NO_PUBLICABLES = new Set(['informacion_falsa', 'duplicado', 'resuelto'])

export function usePeticionesPersona(): UseQueryResult<PeticionPersona[]> {
  return useQuery({
    queryKey: ['peticiones-persona'],
    ...BASE,
    queryFn: async () => {
      const b = backendPrincipalPara('leer:peticiones-persona')
      if (!b?.leer.peticionesPersona) faltaProveedor('las peticiones de la comunidad')
      const todas = await b.leer.peticionesPersona()
      return todas.filter((p) => !ESTADOS_NO_PUBLICABLES.has(p.estado.toLowerCase().trim()))
    },
  })
}

export function useOfrecimientosPersona(): UseQueryResult<OfrecimientoPersona[]> {
  return useQuery({
    queryKey: ['ofrecimientos-persona'],
    ...BASE,
    queryFn: async () => {
      const b = backendPrincipalPara('leer:ofrecimientos-persona')
      if (!b?.leer.ofrecimientosPersona) faltaProveedor('los ofrecimientos de la comunidad')
      const todos = await b.leer.ofrecimientosPersona()
      // `ocultada`: alguien retiró su ofrecimiento a propósito. Se respeta.
      return todos.filter((o) => o.activo)
    },
  })
}

/**
 * Todos los sitios donde vivir, de las fuentes que publiquen alguno.
 *
 * Se piden a TODOS los backends con la capacidad, no al principal: aqui hay dos
 * y ninguna cubre a la otra —una tiene 30 inmuebles del Quindio con foto, la
 * otra 82 de Risaralda con coordenada real y precio—. Quedarse con una sola
 * dejaria fuera dos tercios de la oferta.
 *
 * Si una fuente falla, se muestran las demas: media lista es infinitamente mas
 * util que un error, y quien busca techo no puede esperar a que se arregle.
 */
export function useAlojamientos(): UseQueryResult<Alojamiento[]> {
  return useQuery({
    queryKey: ['alojamientos'],
    ...BASE,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const fuentes = backendsCon('leer:alojamientos').filter((b) => b.leer.alojamientos)
      if (fuentes.length === 0) faltaProveedor('vivienda')

      const partes = await Promise.allSettled(fuentes.map((b) => b.leer.alojamientos!()))
      const todos = partes.flatMap((p) => (p.status === 'fulfilled' ? p.value : []))
      if (todos.length === 0 && partes.every((p) => p.status === 'rejected')) {
        throw (partes[0] as PromiseRejectedResult).reason
      }
      return todos.filter((a) => a.disponible)
    },
  })
}

/**
 * Daños en el terreno: edificios tocados, vías cortadas, servicios abiertos.
 *
 * Se refresca más a menudo que el resto (30 s) porque es lo único que puede
 * cambiar de golpe: una réplica cierra una calle y quien va conduciendo
 * necesita enterarse, no leer lo de hace cinco minutos.
 *
 * No se filtra nada aquí. Con las peticiones sí se filtra —hay reportes
 * marcados como falsos o duplicados que no deben republicarse—, pero la fuente
 * de afectaciones ya entrega solo lo visible: lo que oculta su moderación no
 * sale por la API. Descartar algo más sería borrar un peligro del mapa.
 */
export function useAfectaciones(): UseQueryResult<Afectacion[]> {
  return useQuery({
    queryKey: ['afectaciones'],
    ...BASE,
    staleTime: 30_000,
    queryFn: async () => {
      const b = backendPrincipalPara('leer:afectaciones')
      if (!b?.leer.afectaciones) faltaProveedor('daños y vías cerradas')
      return b.leer.afectaciones()
    },
  })
}

export function useComentariosPeticion(): UseQueryResult<ComentarioPeticion[]> {
  return useQuery({
    queryKey: ['comentarios-peticion'],
    ...BASE,
    queryFn: async () => {
      const b = backendPrincipalPara('leer:comentarios')
      if (!b?.leer.comentarios) faltaProveedor('los comentarios')
      return b.leer.comentarios()
    },
  })
}

export function useVoluntarios(): UseQueryResult<Voluntario[]> {
  return useQuery({
    queryKey: ['voluntarios'],
    ...BASE,
    queryFn: async () => {
      const b = backendPrincipalPara('leer:voluntarios')
      if (!b?.leer.voluntarios) faltaProveedor('voluntarios')
      return b.leer.voluntarios()
    },
  })
}

export function useVehiculos(): UseQueryResult<Vehiculo[]> {
  return useQuery({
    queryKey: ['vehiculos'],
    ...BASE,
    queryFn: async () => {
      const b = backendPrincipalPara('leer:vehiculos')
      if (!b?.leer.vehiculos) faltaProveedor('vehículos')
      return b.leer.vehiculos()
    },
  })
}

/* ------------------------------ Escrituras -------------------------------- */

/** Invalida lo que cambia tras participar, para que la pantalla se refresque. */
function useRefrescar() {
  const cliente = useQueryClient()
  return () => {
    cliente.invalidateQueries({ queryKey: ['necesidades'] })
    cliente.invalidateQueries({ queryKey: ['inventario'] })
  }
}

export function useOfrecerDonacion() {
  const refrescar = useRefrescar()
  return useMutation({
    mutationFn: async (borrador: BorradorOfrecimiento) => {
      const b = backendPrincipalPara('escribir:ofrecimiento')
      if (!b?.escribir.ofrecimiento) faltaProveedor('registro de donaciones')
      await b.escribir.ofrecimiento(borrador)
    },
    onSuccess: refrescar,
  })
}

export function useApuntarseVoluntario() {
  return useMutation({
    mutationFn: async (borrador: BorradorVoluntario) => {
      const b = backendPrincipalPara('escribir:voluntario')
      if (!b?.escribir.voluntario) faltaProveedor('registro de voluntarios')
      await b.escribir.voluntario(borrador)
    },
  })
}

export function useApuntarVehiculo() {
  return useMutation({
    mutationFn: async (borrador: BorradorVehiculo) => {
      const b = backendPrincipalPara('escribir:vehiculo')
      if (!b?.escribir.vehiculo) faltaProveedor('registro de vehículos')
      await b.escribir.vehiculo(borrador)
    },
  })
}

export function useProgramarTransporte() {
  return useMutation({
    mutationFn: async (borrador: BorradorTransporte) => {
      const b = backendPrincipalPara('escribir:transporte')
      if (!b?.escribir.transporte) faltaProveedor('registro de transportes')
      await b.escribir.transporte(borrador)
    },
  })
}

export function useUnirseACentro() {
  return useMutation({
    mutationFn: async (centroId: string) => {
      const b = backendPrincipalPara('escribir:unirse-a-centro')
      if (!b?.escribir.unirseACentro) faltaProveedor('solicitudes para unirse')
      await b.escribir.unirseACentro(centroId)
    },
  })
}

export { mensajeDe }
