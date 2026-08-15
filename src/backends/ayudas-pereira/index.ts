import type { Backend } from '@/backends/contrato'
import type {
  Centro,
  Ciudad,
  ItemInventario,
  Necesidad,
  Transporte,
  TransporteItem,
  Vehiculo,
  Voluntario,
} from '@/dominio/modelos'
import { ErrorApp, comoErrorApp, traducirError } from '@/lib/errores'
import { clienteAP, configuracionIncompleta, usuarioActual } from './cliente'
import {
  COLUMNAS_CENTRO_PUBLICAS,
  COLUMNAS_CIUDAD,
  COLUMNAS_INVENTARIO,
  COLUMNAS_NECESIDAD,
  COLUMNAS_TRANSPORTE,
  COLUMNAS_TRANSPORTE_ITEM,
  COLUMNAS_VEHICULO,
  COLUMNAS_VOLUNTARIO,
  COLUMNA_TELEFONO,
  type FilaCentro,
  type FilaCiudad,
  type FilaInventario,
  type FilaNecesidad,
  type FilaTransporte,
  type FilaTransporteItem,
  type FilaVehiculo,
  type FilaVoluntario,
} from './esquema'
import {
  aCentro,
  aCiudad,
  aItemInventario,
  aNecesidad,
  aTransporte,
  aTransporteItem,
  aVehiculo,
  aVoluntario,
  deOfrecimiento,
  deTransporte,
  deVehiculo,
  deVoluntario,
} from './mapeadores'

/**
 * Backend "Ayudas Pereira".
 *
 * Todo error se traduce aquí: hacia fuera solo salen `ErrorApp` con mensaje
 * humano y código de soporte. Ninguna pantalla ve un 42501.
 */

function comprobarConfig() {
  if (configuracionIncompleta) {
    throw new ErrorApp({
      mensaje: 'La aplicación no está bien configurada.',
      sugerencia: 'Avisa a soporte con este código.',
      codigo: 'AP-CFG0',
      reintentable: false,
    })
  }
}

/** Toda lectura pasa por aquí, para que la traducción de errores sea una sola. */
async function leer<F>(tabla: string, columnas: string, ajustes?: (q: never) => unknown) {
  comprobarConfig()
  let consulta = clienteAP.from(tabla).select(columnas)
  if (ajustes) consulta = ajustes(consulta as never) as typeof consulta

  const { data, error } = await consulta
  if (error) throw new ErrorApp(traducirError(error, 'AP'), error)
  return (data ?? []) as unknown as F[]
}

async function escribir(tabla: string, cuerpo: unknown, opciones?: { upsertPor?: string }) {
  comprobarConfig()

  const consulta = opciones?.upsertPor
    ? clienteAP.from(tabla).upsert(cuerpo as never, { onConflict: opciones.upsertPor })
    : clienteAP.from(tabla).insert(cuerpo as never)

  const { error } = await consulta
  if (error) throw new ErrorApp(traducirError(error, 'AP'), error)
}

/** Las escrituras con `usuario_id` exigen sesión: se comprueba antes de enviar. */
async function exigirSesion(): Promise<string> {
  const id = await usuarioActual()
  if (!id) {
    throw new ErrorApp({
      mensaje: 'Necesitas entrar con tu correo para hacer esto.',
      sugerencia: 'Pulsa "Entrar", te llega un código y vuelves aquí.',
      codigo: 'AP-SES1',
      reintentable: false,
    })
  }
  return id
}

export const ayudasPereira: Backend = {
  descripcion: {
    id: 'ayudas-pereira',
    nombre: 'Ayudas Pereira',
    tipo: 'Centros de acopio',
    descripcion: 'Dónde llevar o recoger donaciones, y qué necesita cada centro.',
    quienPublica: 'El equipo que coordina cada centro.',
    url: 'https://alluda.online',
    capacidades: [
      'leer:municipios',
      'leer:centros',
      'leer:necesidades',
      'leer:inventario',
      'leer:transportes',
      'leer:transporte-items',
      'leer:voluntarios',
      'leer:vehiculos',
      'escribir:ofrecimiento',
      'escribir:voluntario',
      'escribir:vehiculo',
      'escribir:transporte',
      'escribir:unirse-a-centro',
      'sesion:correo',
    ],
  },

  leer: {
    async municipios(): Promise<Ciudad[]> {
      const filas = await leer<FilaCiudad>('ciudades', COLUMNAS_CIUDAD, (q) =>
        (q as unknown as { order: (c: string) => unknown }).order('nombre'),
      )
      return filas.map(aCiudad)
    },

    async centros(conSesion: boolean): Promise<Centro[]> {
      // `telefono` solo se pide con sesión: incluirla sin ella tumba la
      // consulta entera y la pantalla se queda sin ningún centro.
      const columnas = conSesion
        ? [...COLUMNAS_CENTRO_PUBLICAS, COLUMNA_TELEFONO].join(',')
        : COLUMNAS_CENTRO_PUBLICAS.join(',')

      const filas = await leer<FilaCentro>('centros', columnas, (q) =>
        (q as unknown as { eq: (c: string, v: unknown) => unknown }).eq('activo', true),
      )
      return filas.map(aCentro)
    },

    async necesidades(): Promise<Necesidad[]> {
      const filas = await leer<FilaNecesidad>('necesidades', COLUMNAS_NECESIDAD)
      return filas.map(aNecesidad)
    },

    async inventario(): Promise<ItemInventario[]> {
      const filas = await leer<FilaInventario>('inventario', COLUMNAS_INVENTARIO)
      return filas.map(aItemInventario)
    },

    async transportes(): Promise<Transporte[]> {
      const filas = await leer<FilaTransporte>('transportes', COLUMNAS_TRANSPORTE)
      return filas.map(aTransporte)
    },

    async transporteItems(): Promise<TransporteItem[]> {
      const filas = await leer<FilaTransporteItem>(
        'transporte_items',
        COLUMNAS_TRANSPORTE_ITEM,
      )
      return filas.map(aTransporteItem)
    },

    async voluntarios(): Promise<Voluntario[]> {
      const filas = await leer<FilaVoluntario>('voluntarios', COLUMNAS_VOLUNTARIO)
      return filas.map(aVoluntario)
    },

    async vehiculos(): Promise<Vehiculo[]> {
      const filas = await leer<FilaVehiculo>('vehiculos', COLUMNAS_VEHICULO)
      return filas.map(aVehiculo)
    },
  },

  escribir: {
    /** Ofrecer una donación. No exige sesión: la tabla no guarda usuario_id. */
    async ofrecimiento(borrador) {
      await escribir('ofrecimientos', deOfrecimiento(borrador))
    },

    async voluntario(borrador) {
      const usuarioId = await exigirSesion()
      await escribir('voluntarios', deVoluntario(borrador, usuarioId))
    },

    async vehiculo(borrador) {
      const usuarioId = await exigirSesion()
      await escribir('vehiculos', deVehiculo(borrador, usuarioId))
    },

    async transporte(borrador) {
      await exigirSesion()
      await escribir('transportes', deTransporte(borrador, new Date().toISOString()))
    },

    /**
     * Pedir unirse al equipo de un centro. Es un upsert por (centro, usuario):
     * pulsar dos veces no crea dos solicitudes ni da error al usuario.
     */
    async unirseACentro(centroId) {
      const usuarioId = await exigirSesion()
      await escribir(
        'solicitudes',
        { centro_id: centroId, usuario_id: usuarioId, estado: 'pendiente' },
        { upsertPor: 'centro_id,usuario_id' },
      )
    },
  },
}

/* ------------------------------- Sesión ----------------------------------- */
/* Vive aquí porque el correo y el código los gestiona este backend, no la app. */

export async function enviarCodigo(correo: string): Promise<void> {
  comprobarConfig()
  const { error } = await clienteAP.auth.signInWithOtp({
    email: correo.trim(),
    options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
  })
  if (error) throw comoErrorApp(error, 'AP-AUTH')
}

export async function verificarCodigo(correo: string, codigo: string): Promise<void> {
  comprobarConfig()
  const { error } = await clienteAP.auth.verifyOtp({
    email: correo.trim(),
    token: codigo.trim(),
    type: 'email',
  })
  if (error) throw comoErrorApp(error, 'AP-AUTH')
}

export async function cerrarSesion(): Promise<void> {
  await clienteAP.auth.signOut()
}

export { clienteAP }
