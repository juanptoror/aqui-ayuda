/**
 * Taxonomía única de dos niveles para cruzar los dos backends.
 *
 * El problema: Ayudas Pereira usa 10 categorías y Corag 12, y ni siquiera son
 * el mismo eje —unas dicen QUÉ COSA ("Cobijas y colchonetas") y otras QUÉ
 * NECESIDAD ("refugio", "transporte")—. Sin traducir, ningún cruce funciona.
 *
 * La solución es una taxonomía propia con dos niveles:
 *   - GENERAL: para agrupar y para cruzar cuando no hay equivalencia exacta.
 *   - SUBCATEGORÍA: para cruzar con precisión cuando ambos hablan de lo mismo.
 *
 * Dos reglas que evitan cruces absurdos:
 *   1. Lo que no es material (`transporte`, `voluntariado`, `acopio`) se marca
 *      como servicio y NUNCA se cruza contra inventario: nadie tiene "cinco
 *      cajas de voluntariado" en una bodega.
 *   2. El cruce exacto (misma subcategoría) vale más que el aproximado (misma
 *      general), y la UI lo dice para no prometer más de lo que sabe.
 */

export type General =
  | 'agua-alimentacion'
  | 'salud'
  | 'higiene'
  | 'abrigo'
  | 'herramientas'
  | 'animales'
  | 'servicios'
  | 'otros'

export interface DefinicionGeneral {
  id: General
  nombre: string
  /** Un servicio es ayuda que se presta, no cosas que se guardan. */
  esServicio: boolean
}

export const GENERALES: Record<General, DefinicionGeneral> = {
  'agua-alimentacion': { id: 'agua-alimentacion', nombre: 'Agua y alimentación', esServicio: false },
  salud: { id: 'salud', nombre: 'Salud', esServicio: false },
  higiene: { id: 'higiene', nombre: 'Higiene', esServicio: false },
  abrigo: { id: 'abrigo', nombre: 'Abrigo y descanso', esServicio: false },
  herramientas: { id: 'herramientas', nombre: 'Herramientas y energía', esServicio: false },
  animales: { id: 'animales', nombre: 'Animales', esServicio: false },
  servicios: { id: 'servicios', nombre: 'Manos y logística', esServicio: true },
  otros: { id: 'otros', nombre: 'Otros', esServicio: false },
}

export type Subcategoria =
  | 'agua'
  | 'alimentos-no-perecederos'
  | 'comidas-listas'
  | 'medicamentos'
  | 'salud-general'
  | 'aseo'
  | 'panales-bebes'
  | 'cobijas-colchonetas'
  | 'ropa'
  | 'alojamiento'
  | 'linternas-pilas'
  | 'herramienta-menor'
  | 'mascotas'
  | 'transporte'
  | 'voluntariado'
  | 'acopio'
  | 'servicios-tecnicos'
  | 'otros'

export interface DefinicionSub {
  id: Subcategoria
  nombre: string
  general: General
}

export const SUBCATEGORIAS: Record<Subcategoria, DefinicionSub> = {
  agua: { id: 'agua', nombre: 'Agua', general: 'agua-alimentacion' },
  'alimentos-no-perecederos': {
    id: 'alimentos-no-perecederos',
    nombre: 'Alimentos no perecederos',
    general: 'agua-alimentacion',
  },
  'comidas-listas': {
    id: 'comidas-listas',
    nombre: 'Comidas listas para comer',
    general: 'agua-alimentacion',
  },
  medicamentos: { id: 'medicamentos', nombre: 'Medicamentos', general: 'salud' },
  'salud-general': { id: 'salud-general', nombre: 'Atención en salud', general: 'salud' },
  aseo: { id: 'aseo', nombre: 'Aseo e higiene', general: 'higiene' },
  'panales-bebes': { id: 'panales-bebes', nombre: 'Pañales y bebés', general: 'higiene' },
  'cobijas-colchonetas': {
    id: 'cobijas-colchonetas',
    nombre: 'Cobijas y colchonetas',
    general: 'abrigo',
  },
  ropa: { id: 'ropa', nombre: 'Ropa y calzado', general: 'abrigo' },
  alojamiento: { id: 'alojamiento', nombre: 'Alojamiento', general: 'abrigo' },
  'linternas-pilas': {
    id: 'linternas-pilas',
    nombre: 'Linternas y pilas',
    general: 'herramientas',
  },
  'herramienta-menor': {
    id: 'herramienta-menor',
    nombre: 'Herramientas',
    general: 'herramientas',
  },
  mascotas: { id: 'mascotas', nombre: 'Mascotas', general: 'animales' },
  transporte: { id: 'transporte', nombre: 'Transporte', general: 'servicios' },
  voluntariado: { id: 'voluntariado', nombre: 'Voluntariado', general: 'servicios' },
  acopio: { id: 'acopio', nombre: 'Centro de acopio', general: 'servicios' },
  /* Peritaje estructural, ingenieria y asesoria legal. Es un servicio
     profesional: nadie lo guarda en una bodega ni lo lleva en una caja. */
  'servicios-tecnicos': {
    id: 'servicios-tecnicos',
    nombre: 'Revision tecnica y legal',
    general: 'servicios',
  },
  otros: { id: 'otros', nombre: 'Otros', general: 'otros' },
}

/* --------------------------- Equivalencias por backend --------------------- */

/** Categorías de Ayudas Pereira → subcategoría. Coinciden casi una a una. */
const DESDE_AYUDAS_PEREIRA: Record<string, Subcategoria> = {
  agua: 'agua',
  'alimentos no perecederos': 'alimentos-no-perecederos',
  'comidas listas para comer': 'comidas-listas',
  'aseo e higiene': 'aseo',
  'panales y bebes': 'panales-bebes',
  medicamentos: 'medicamentos',
  'cobijas y colchonetas': 'cobijas-colchonetas',
  'ropa y franelas': 'ropa',
  'linternas y pilas': 'linternas-pilas',
  otros: 'otros',
}

/**
 * Categorías de Corag → subcategoría.
 *
 * Dos decisiones que conviene tener a la vista porque no son obvias:
 * - `salud` NO es lo mismo que `medicamentos`: puede ser atención, curaciones
 *   o traslado sanitario. Va a su propia subcategoría, dentro de la misma
 *   general, así que cruza a nivel general pero no promete equivalencia exacta.
 * - `refugio` va a "alojamiento", no a "cobijas": quien pide refugio pide dónde
 *   dormir, no una manta. Comparten la general "Abrigo y descanso".
 */
const DESDE_CORAG: Record<string, Subcategoria> = {
  agua: 'agua',
  alimentos: 'alimentos-no-perecederos',
  medicamentos: 'medicamentos',
  salud: 'salud-general',
  ropa: 'ropa',
  refugio: 'alojamiento',
  herramientas: 'herramienta-menor',
  mascotas: 'mascotas',
  transporte: 'transporte',
  voluntariado: 'voluntariado',
  acopio: 'acopio',
  otro: 'otros',
  // Vistas en datos reales de Corag aunque no estén en su documentación.
  aseo: 'aseo',
  higiene: 'aseo',
  bebes: 'panales-bebes',
  cobijas: 'cobijas-colchonetas',
}

/** Quita tildes y normaliza para comparar etiquetas escritas a mano. */
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')

function clave(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(DIACRITICOS, '')
}

/**
 * Vocabulario propio de Pereira Unida, medido sobre sus 282 reportes y 296
 * ofrecimientos. Dos etiquetas no encajan en ninguna categoría de las otras
 * fuentes y por eso importan:
 *
 * - `revision_ingenieria` (13 reportes): alguien pide que un ingeniero mire si
 *   su casa se puede habitar. Es un servicio profesional, no un material, y
 *   cruzarlo contra inventario sería absurdo.
 * - `psicologia` (43 ofrecimientos): apoyo emocional. Cae en Salud a nivel
 *   general, pero no en Medicamentos: quien ofrece escuchar no tiene cajas.
 */
const DESDE_PEREIRA_UNIDA: Record<string, Subcategoria> = {
  alimentos: 'alimentos-no-perecederos',
  alimentacion: 'comidas-listas',
  agua: 'agua',
  medicinas: 'medicamentos',
  medico: 'salud-general',
  enfermeria: 'salud-general',
  psicologia: 'salud-general',
  ropa: 'ropa',
  refugio: 'alojamiento',
  herramientas: 'herramienta-menor',
  herramientas_rescate: 'herramienta-menor',
  rescate: 'voluntariado',
  mascotas: 'mascotas',
  transporte: 'transporte',
  transporte_logistica: 'transporte',
  voluntariado: 'voluntariado',
  oficios: 'voluntariado',
  revision_ingenieria: 'servicios-tecnicos',
  ingenieria: 'servicios-tecnicos',
  legal: 'servicios-tecnicos',
  otro: 'otros',
  otros: 'otros',
}

export type OrigenCategoria = 'ayudas-pereira' | 'corag' | 'pereira-unida'

/**
 * Traduce la categoría de un backend a la taxonomía común.
 * Lo desconocido cae en "otros" en vez de romper: aparecer mal clasificado es
 * mejor que desaparecer de la pantalla.
 */
export function aSubcategoria(categoria: string, origen: OrigenCategoria): Subcategoria {
  const k = clave(categoria)
  const tabla =
    origen === 'corag'
      ? DESDE_CORAG
      : origen === 'pereira-unida'
        ? DESDE_PEREIRA_UNIDA
        : DESDE_AYUDAS_PEREIRA
  if (tabla[k]) return tabla[k]

  // Coincidencia parcial: los datos traen etiquetas libres ("ropa talla 3").
  for (const [etiqueta, sub] of Object.entries(tabla)) {
    if (k.includes(etiqueta) || etiqueta.includes(k)) return sub
  }
  return 'otros'
}

export function aGeneral(categoria: string, origen: OrigenCategoria): General {
  return SUBCATEGORIAS[aSubcategoria(categoria, origen)].general
}

export function esServicio(categoria: string, origen: OrigenCategoria): boolean {
  return GENERALES[aGeneral(categoria, origen)].esServicio
}

export function nombreDe(sub: Subcategoria): string {
  return SUBCATEGORIAS[sub].nombre
}

export type Precision = 'exacta' | 'aproximada' | 'ninguna'

/**
 * Cómo de bien casan dos categorías de backends distintos.
 * La UI muestra esta precisión para no prometer más de lo que sabe: no es lo
 * mismo "tiene justo lo que pides" que "tiene algo de la misma familia".
 */
export function comparar(
  categoriaA: string,
  origenA: OrigenCategoria,
  categoriaB: string,
  origenB: OrigenCategoria,
): Precision {
  const subA = aSubcategoria(categoriaA, origenA)
  const subB = aSubcategoria(categoriaB, origenB)
  if (subA === subB) return 'exacta'

  const genA = SUBCATEGORIAS[subA].general
  const genB = SUBCATEGORIAS[subB].general
  // "Otros" con "Otros" no es un parecido: es que no sabemos ni de qué hablan.
  if (genA === genB && genA !== 'otros') return 'aproximada'
  return 'ninguna'
}
