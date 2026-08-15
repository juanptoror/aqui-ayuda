import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { backendPrincipalPara } from '@/backends/registro'
import type {
  BorradorOfrecimiento,
  BorradorTransporte,
  BorradorVehiculo,
  BorradorVoluntario,
} from '@/backends/contrato'
import { ErrorApp, mensajeDe } from '@/lib/errores'
import type { Centro, Ciudad, ItemInventario, Necesidad, Transporte } from '@/dominio/modelos'

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
