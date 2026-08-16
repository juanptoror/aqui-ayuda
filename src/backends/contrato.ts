import type {
  Afectacion,
  Alojamiento,
  Centro,
  Ciudad,
  Coordenada,
  ItemInventario,
  Necesidad,
  ComentarioPeticion,
  OfrecimientoPersona,
  PeticionPersona,
  Transporte,
  TransporteItem,
  Vehiculo,
  Voluntario,
} from '@/dominio/modelos'

/**
 * Contrato que cumple TODO backend conectado a la app.
 *
 * La regla que ordena esta carpeta: la interfaz no sabe nada de Supabase, de
 * PostgREST ni de REST. Habla de municipios, centros y necesidades. Cada
 * backend traduce entre su esquema y este vocabulario en su propia carpeta, y
 * nadie fuera de `src/backends/<nombre>/` importa su cliente.
 *
 * Para añadir un tercer backend: crear la carpeta, implementar lo que pueda de
 * este contrato, declarar sus capacidades y registrarlo. Ninguna pantalla
 * cambia, porque las pantallas preguntan por capacidades, no por nombres.
 */

export type IdBackend =
  | 'ayudas-pereira'
  | 'corag'
  | 'pereira-unida'
  | 'vivienda'
  | 'pereira-responde'

/**
 * Lo que un backend sabe hacer. La UI pregunta por esto antes de ofrecer un
 * botón, en vez de asumir que todos los backends hacen lo mismo.
 */
export type Capacidad =
  | 'leer:municipios'
  | 'leer:centros'
  | 'leer:necesidades'
  | 'leer:inventario'
  | 'leer:ayuda-directa'
  | 'leer:voluntarios'
  | 'leer:vehiculos'
  | 'leer:transportes'
  | 'leer:transporte-items'
  | 'leer:peticiones-persona'
  | 'leer:ofrecimientos-persona'
  | 'leer:comentarios'
  | 'leer:alojamientos'
  | 'leer:afectaciones'
  | 'escribir:ofrecimiento'
  | 'escribir:voluntario'
  | 'escribir:vehiculo'
  | 'escribir:transporte'
  | 'escribir:unirse-a-centro'
  | 'escribir:ayuda-directa'
  | 'escribir:alojamiento'
  /** Publicar un daño. Pasa por servidor: la fuente exige clave y la esconde. */
  | 'escribir:afectacion'
  | 'sesion:correo'

export interface DescripcionBackend {
  id: IdBackend
  /** Nombre para el público. Aparece en el sello de procedencia. */
  nombre: string
  /** Qué aporta, en palabras de cualquiera. */
  tipo: string
  descripcion: string
  quienPublica: string
  url: string | null
  capacidades: readonly Capacidad[]
}

/* ------------------------------ Lecturas ---------------------------------- */

export interface LecturasBackend {
  municipios?: () => Promise<Ciudad[]>
  /** `conSesion` decide si se piden campos restringidos como el teléfono. */
  centros?: (conSesion: boolean) => Promise<Centro[]>
  necesidades?: () => Promise<Necesidad[]>
  inventario?: () => Promise<ItemInventario[]>
  transportes?: () => Promise<Transporte[]>
  /** Desglose de qué viaja en cada transporte, por categoría. */
  transporteItems?: () => Promise<TransporteItem[]>
  /** Personas concretas pidiendo ayuda, no organizaciones. */
  peticionesPersona?: () => Promise<PeticionPersona[]>
  /** Personas que se ofrecen a echar una mano. */
  ofrecimientosPersona?: () => Promise<OfrecimientoPersona[]>
  comentarios?: () => Promise<ComentarioPeticion[]>
  /** Sitios donde vivir. Dos fuentes publican arriendos y no se solapan. */
  alojamientos?: () => Promise<Alojamiento[]>
  /** Daños en edificios, vías y servicios. No son peticiones: son el terreno. */
  afectaciones?: () => Promise<Afectacion[]>
  voluntarios?: () => Promise<Voluntario[]>
  vehiculos?: () => Promise<Vehiculo[]>
}

/* ------------------------------ Escrituras -------------------------------- */

export interface BorradorOfrecimiento {
  ciudadId: string
  /** Centro concreto, o null si se ofrece a la ciudad entera. */
  centroId: string | null
  /** Necesidad concreta que se cubre, si el ofrecimiento nace de una. */
  necesidadId: string | null
  categoria: string
  descripcion: string
  nombre: string
  telefono: string
  necesitaTransporte: boolean
  direccionRecogida: string
}

export interface BorradorVoluntario {
  ciudadId: string
  centroId: string | null
  nombre: string
  telefono: string
  /** Tareas que la persona marcó. */
  puedeAyudarEn: string[]
  disponibilidad: string[]
  notas: string
}

export interface BorradorVehiculo {
  ciudadId: string
  nombre: string
  telefono: string
  vehiculo: string
  capacidad: string
  zona: string
}

export interface BorradorTransporte {
  ciudadId: string
  origenId: string
  destinoId: string | null
  destinoTexto: string
  carga: string
  vehiculo: string
  conductor: string
  telefono: string
  /** ISO 8601, o null para registrar la salida al ponerlo en ruta. */
  salida: string | null
  notas: string
}

export interface BorradorAlojamiento {
  titulo: string
  descripcion: string
  tipo: string
  ciudad: string
  barrio: string
  precio: number | null
  habitaciones: number
  banos: number
  parqueaderos: number
  areaM2: number | null
  whatsapp: string
}

export interface EscriturasBackend {
  ofrecimiento?: (b: BorradorOfrecimiento) => Promise<void>
  voluntario?: (b: BorradorVoluntario) => Promise<void>
  vehiculo?: (b: BorradorVehiculo) => Promise<void>
  transporte?: (b: BorradorTransporte) => Promise<void>
  /** Pide unirse al equipo de un centro. Idempotente por (centro, usuario). */
  unirseACentro?: (centroId: string) => Promise<void>
  alojamiento?: (b: BorradorAlojamiento) => Promise<void>
}

export interface Backend {
  descripcion: DescripcionBackend
  leer: LecturasBackend
  escribir: EscriturasBackend
  /** Coordenada conocida de un municipio, si el backend la aporta. */
  coordenadaDeMunicipio?: (slug: string) => Coordenada | null
}

export function tieneCapacidad(backend: Backend, capacidad: Capacidad): boolean {
  return backend.descripcion.capacidades.includes(capacidad)
}
