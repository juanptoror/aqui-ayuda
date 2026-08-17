/**
 * Modelos del dominio. No dependen de ningún backend.
 *
 * Si mañana Ayudas Pereira renombra una columna o entra un tercer proveedor,
 * lo que cambia es el mapeador de ese backend, no estos tipos ni la UI.
 */

export type Prioridad = 'urgente' | 'alta' | 'normal'
export type EstadoNecesidad = 'pendiente' | 'cubierta'

export interface Coordenada {
  lat: number
  lng: number
}

export interface Ciudad {
  id: string
  nombre: string
  departamento: string
  slug: string
  activa: boolean
  /** Si no es null, esta ciudad fue fusionada en otra y no debe listarse. */
  fusionadaEn: string | null
}

export interface Centro {
  id: string
  ciudadId: string | null
  nombre: string
  direccion: string | null
  responsable: string | null
  /** Texto libre donde los centros escriben horario y qué reciben. */
  notas: string | null
  activo: boolean
  /** Si está recibiendo ahora mismo. Lo primero antes de desplazarse. */
  abierto: boolean
  lat: number | null
  lng: number | null
  foto: string | null
  /** Solo llega con sesión: el backend restringe esta columna. */
  telefono?: string | null
}

export interface Necesidad {
  id: string
  centroId: string
  categoria: string
  descripcion: string | null
  prioridad: Prioridad
  estado: EstadoNecesidad
  creadaEn: string
}

export interface ItemInventario {
  id: string
  centroId: string
  categoria: string
  cantidad: number
  unidad: string
  actualizadoEn: string
}

/** Centro enriquecido con lo que se calcula en cliente para la UI. */
export interface CentroVista extends Centro {
  necesidades: Necesidad[]
  inventario: ItemInventario[]
  urgentes: number
  pendientes: number
  /** Kilómetros hasta el usuario, o null si falta alguna coordenada. */
  distanciaKm: number | null
}

export interface Voluntario {
  id: string
  ciudadId: string | null
  centroId: string | null
  nombre: string
  /** Tareas que marcó, ya separadas. */
  puedeAyudarEn: string[]
  disponibilidad: string[]
  notas: string | null
  disponible: boolean
}

export interface Vehiculo {
  id: string
  ciudadId: string | null
  nombre: string
  vehiculo: string
  capacidad: string | null
  zona: string | null
  disponible: boolean
}

export type EstadoTransporte = 'programado' | 'en_ruta' | 'entregado' | 'cancelado'

export interface Transporte {
  id: string
  ciudadId: string | null
  origenId: string | null
  destinoId: string | null
  /** Destino escrito a mano cuando no es un centro del listado. */
  destinoTexto: string | null
  carga: string | null
  vehiculo: string | null
  conductor: string | null
  estado: EstadoTransporte
  /** Hora de salida prevista, o null si se registra al ponerlo en ruta. */
  salida: string | null
  notas: string | null
  creadoEn: string
}

/**
 * Qué va exactamente dentro de un transporte.
 *
 * `carga` es texto libre —"varias cosas", "lo del sábado"— y no sirve para
 * saber si lo que viaja es lo que hace falta al otro lado. Esto sí: categoría,
 * cantidad y unidad, que es lo que se puede cruzar contra una necesidad.
 */
export interface TransporteItem {
  id: string
  transporteId: string
  categoria: string
  cantidad: number
  unidad: string | null
}

/** Una categoría con dónde está y cuánto hay. Alimenta la vista de inventario. */
export interface ExistenciaPorCentro {
  centroId: string
  centroNombre: string
  centroAbierto: boolean
  cantidad: number
  unidad: string
  actualizadoEn: string
}

export interface ResumenCategoria {
  categoria: string
  /** Suma por unidad: no se pueden sumar cajas con kits. */
  totalesPorUnidad: { unidad: string; cantidad: number }[]
  disponibleEn: ExistenciaPorCentro[]
  /** Centros que la están pidiendo, con su prioridad más alta. */
  solicitadaEn: {
    centroId: string
    centroNombre: string
    centroAbierto: boolean
    prioridad: Prioridad
    descripcion: string | null
  }[]
}

/** Las 10 categorías que aparecen en los datos reales. */
export const CATEGORIAS = [
  'Agua',
  'Alimentos no perecederos',
  'Comidas listas para comer',
  'Aseo e higiene',
  'Pañales y bebés',
  'Medicamentos',
  'Cobijas y colchonetas',
  'Ropa y franelas',
  'Linternas y pilas',
  'Otros',
] as const

export type Categoria = (typeof CATEGORIAS)[number]

/** Tareas de voluntariado, tal como las ofrece Ayudas Pereira. */
export const TAREAS_VOLUNTARIO = [
  'Clasificar y empacar',
  'Cargar y descargar',
  'Cocinar',
  'Atender a la gente',
  'Inventario y listas',
  'Aseo',
] as const

export const FRANJAS_DISPONIBILIDAD = [
  'Mañanas',
  'Tardes',
  'Noches',
  'Fines de semana',
  'A cualquier hora',
] as const

/**
 * Una persona pidiendo ayuda, geolocalizada y con teléfono público.
 *
 * Es la forma que comparten fuentes distintas —Corag y Pereira Unida— cuando
 * quien pide no es una organización sino alguien concreto. La app las presenta
 * juntas porque para quien va a ayudar son lo mismo, pero cada una lleva su
 * sello de origen: si el dato está mal, hay que saber a quién reclamar.
 */
export interface PeticionPersona {
  id: string
  titulo: string
  descripcion: string | null
  categoria: string
  urgente: boolean
  /** Texto tal cual lo publica la fuente: "buscando", "activa", "resuelto". */
  estado: string
  municipio: string | null
  departamento: string | null
  lugar: string | null
  lat: number | null
  lng: number | null
  /** Público en origen. No lo desbloqueamos nosotros: ya está publicado allí. */
  telefono: string | null
  fotos: string[]
  creadaEn: string
  /** Última vez que alguien de la comunidad confirmó que sigue vigente. */
  confirmadaEn: string | null
}

/** Alguien que ofrece echar una mano, con su teléfono y lo que sabe hacer. */
export interface OfrecimientoPersona {
  id: string
  nombre: string
  /** Qué ofrece: "alimentacion", "transporte", "medica"… */
  habilidad: string
  descripcion: string | null
  telefono: string | null
  municipio: string | null
  departamento: string | null
  activo: boolean
  creadoEn: string
}

/** Un comentario de la comunidad sobre una petición. */
export interface ComentarioPeticion {
  id: string
  peticionId: string
  autor: string | null
  texto: string
  creadoEn: string
}

/**
 * Un sitio donde vivir, venga de donde venga.
 *
 * Dos fuentes publican arriendos y ninguna cubre a la otra: el listado de
 * `inmuebles` está en el Quindío, con foto y sin coordenada útil; los `rentals`
 * de Pereira Unida están en Risaralda, con coordenada real y precio pero casi
 * sin foto. Juntarlos no crea duplicados —no comparten ni departamento— y sí
 * duplica largamente la oferta que ve alguien que se quedó sin casa.
 *
 * `lat`/`lng` son null cuando la fuente no tiene una coordenada de fiar. Es
 * deliberado: un backend publica 4.7/-74.05 (Bogotá) para inmuebles de Armenia,
 * y propagar eso pondría pines a 150 km del sitio real.
 */
export interface Alojamiento {
  id: string
  origen: 'vivienda' | 'pereira-unida'
  titulo: string
  descripcion: string | null
  tipo: string
  ciudad: string
  departamento: string | null
  barrio: string | null
  direccion: string | null
  /** Canon mensual en pesos, o null si la fuente no lo publica como número. */
  precioMes: number | null
  /** El canon rescatado del texto libre, cuando no está en su campo. */
  precioEnTexto: string | null
  amoblado: boolean | null
  habitaciones: number | null
  banos: number | null
  parqueaderos: number | null
  areaM2: number | null
  disponible: boolean
  lat: number | null
  lng: number | null
  fotos: string[]
  telefono: string | null
  /** Cuánta gente ya preguntó, si la fuente lo cuenta. */
  contactos: number | null
  publicadoEn: string
}

/* ------------------------------ Afectaciones ------------------------------- */

/**
 * Un daño en el terreno: un edificio tocado, una vía cortada, un servicio
 * abierto, un barrio sin luz.
 *
 * Es la única cosa de esta aplicación que NO es una petición ni una oferta.
 * Nadie está pidiendo nada aquí: es el estado físico de la ciudad después del
 * terremoto. Se modela aparte de `PeticionPersona` justamente por eso —un
 * edificio a punto de caerse no tiene teléfono al que llamar ni categoría de
 * donación— y porque mezclarlo haría que la pantalla de "quién necesita ayuda"
 * mandara a alguien a tocar el timbre de una casa colapsada.
 */
export type TipoAfectacion = 'vivienda' | 'via' | 'apoyo' | 'servicio-publico'

/**
 * Gravedad declarada por quien reportó.
 *
 * Solo existe de verdad en las afectaciones de vivienda. En los demás tipos la
 * fuente repite el tipo dentro del campo de riesgo (`risk: "road"`), así que ahí
 * no hay severidad que enseñar y se dice `sin-clasificar` en vez de inventar una.
 */
export type GravedadAfectacion = 'alta' | 'media' | 'sin-clasificar'

export interface Afectacion {
  id: string
  tipo: TipoAfectacion
  gravedad: GravedadAfectacion
  /** Clase del daño, del catálogo cerrado de la fuente. */
  titulo: string
  /** Qué servicio es: refugio, acopio. Null en vivienda y vía. */
  subtipo: string | null
  /** Nota de quien reportó. Null cuando no escribió ninguna. */
  nota: string | null
  /** null solo por defensa: los 180 reportes reales traen coordenada. */
  lat: number | null
  lng: number | null
  /** Fotos a tamaño de cámara. Ver la nota de peso en el backend. */
  fotos: string[]
  /** Cuánta gente confirmó que sigue así. */
  confirmaciones: number
  /** Balance de votos. Coincide con las confirmaciones mientras nadie vote en contra. */
  balance: number
  reportadaEn: string
}

/**
 * Cómo se nombra cada tipo en pantalla.
 *
 * Se respeta el vocabulario de la fuente —"Edificio", "Vía", "Servicio
 * abierto", "servicio público"— porque es el que ve quien reporta. Que la app y
 * la fuente llamen distinto a lo mismo obliga a traducir mentalmente justo
 * cuando nadie tiene cabeza para eso.
 *
 * "Servicio abierto" y "Servicio público" se parecen y no son lo mismo: el
 * primero es un sitio que sigue atendiendo —una farmacia, un refugio— y el
 * segundo es la red que dejó de funcionar. En Colombia "servicios públicos" es
 * justamente la factura de la luz y el agua, así que la palabra ya viene
 * entendida de casa; los `descripcion` de cada uno terminan de separarlos.
 */
export const TIPOS_AFECTACION: Record<
  TipoAfectacion,
  { nombre: string; plural: string; descripcion: string }
> = {
  vivienda: {
    nombre: 'Edificio',
    plural: 'Edificios',
    descripcion: 'Casas y edificios con daño estructural.',
  },
  via: {
    nombre: 'Vía',
    plural: 'Vías',
    descripcion: 'Calles cerradas o con paso restringido.',
  },
  apoyo: {
    nombre: 'Servicio abierto',
    plural: 'Servicios abiertos',
    descripcion: 'Refugios y zonas de acopio señaladas en el terreno.',
  },
  'servicio-publico': {
    nombre: 'Servicio público',
    plural: 'Servicios públicos',
    descripcion: 'Cortes de luz, agua, gas o internet, y postes o cables caídos.',
  },
}

export const GRAVEDADES_AFECTACION: Record<GravedadAfectacion, string> = {
  alta: 'Riesgo alto',
  media: 'Riesgo medio',
  'sin-clasificar': 'Sin clasificar',
}
