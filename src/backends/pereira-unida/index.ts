import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Backend } from '@/backends/contrato'
import type {
  Afectacion,
  AlcanceServicio,
  Alojamiento,
  ComentarioPeticion,
  GravedadAfectacion,
  OfrecimientoPersona,
  PeticionPersona,
  ServicioAfectado,
} from '@/dominio/modelos'
import { ErrorApp, traducirError } from '@/lib/errores'
import {
  COLUMNAS_COMENTARIO,
  COLUMNAS_OFERTA,
  COLUMNAS_RENTAL,
  COLUMNAS_REPORTE,
  COLUMNAS_SERVICIO,
  type FilaComentario,
  type FilaOferta,
  type FilaRental,
  type FilaReporte,
  type FilaServicio,
} from './esquema'

/**
 * Backend "Pereira Unida".
 *
 * Tercera fuente. Aporta lo que ninguna de las otras dos tiene junto: personas
 * concretas pidiendo ayuda **con teléfono público** y personas ofreciéndola
 * **también con teléfono**. En Ayudas Pereira el teléfono está denegado al rol
 * público, y en Corag solo aparece si quien publica marca la casilla; aquí es
 * parte del dato, porque el tablón nació así.
 *
 * Eso obliga a una decisión que se toma aquí y no en la interfaz: **no
 * republicamos nada que la fuente no publique ya**. Lo que se muestra es
 * exactamente lo que cualquiera ve entrando en Pereira Unida.
 */

const url = import.meta.env.VITE_PU_URL
const anonKey = import.meta.env.VITE_PU_ANON_KEY

export const configuracionIncompleta: string | null =
  !url || !anonKey ? 'Falta la configuración de conexión con Pereira Unida.' : null

/* Sin sesión: este backend no autentica a nadie. Guardar sesión aquí pisaría
   la de Ayudas Pereira, que sí la usa, porque comparten el almacenamiento. */
const cliente: SupabaseClient = createClient(url ?? '', anonKey ?? '', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { 'x-application-name': 'aquiayuda-web' } },
})

async function leer<F>(tabla: string, columnas: string, ajustes?: (q: never) => unknown) {
  if (configuracionIncompleta) {
    throw new ErrorApp({
      mensaje: 'La aplicación no está bien configurada.',
      sugerencia: 'Avisa a soporte con este código.',
      codigo: 'PU-CFG0',
      reintentable: false,
    })
  }
  let consulta = cliente.from(tabla).select(columnas)
  if (ajustes) consulta = ajustes(consulta as never) as typeof consulta

  const { data, error } = await consulta
  if (error) throw new ErrorApp(traducirError(error, 'PU'), error)
  return (data ?? []) as unknown as F[]
}

function limpio(v: string | null | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

/* `urgent_level` viene como texto libre. Se normaliza aquí para que la interfaz
   no tenga que conocer el vocabulario de esta fuente. */
const NIVELES_URGENTES = new Set(['critico', 'crítico', 'urgente', 'alto', 'alta'])

function aPeticion(f: FilaReporte): PeticionPersona {
  return {
    id: f.id,
    titulo: limpio(f.title) ?? 'Petición sin título',
    descripcion: limpio(f.description),
    categoria: limpio(f.category) ?? 'otro',
    urgente: NIVELES_URGENTES.has((f.urgent_level ?? '').toLowerCase().trim()),
    estado: limpio(f.status) ?? 'buscando',
    municipio: limpio(f.municipality),
    departamento: limpio(f.department),
    lugar: limpio(f.location_name),
    lat: f.lat,
    lng: f.lng,
    telefono: limpio(f.contact_phone),
    fotos: Array.isArray(f.photo_urls) ? f.photo_urls.filter(Boolean) : [],
    creadaEn: f.created_at,
    confirmadaEn: f.last_confirmed_at,
  }
}

function aOfrecimiento(f: FilaOferta): OfrecimientoPersona {
  return {
    id: f.id,
    nombre: limpio(f.full_name) ?? 'Sin nombre',
    habilidad: limpio(f.skill) ?? 'otro',
    descripcion: limpio(f.description),
    telefono: limpio(f.phone),
    municipio: limpio(f.municipality),
    departamento: limpio(f.department),
    activo: (f.status ?? 'activa').toLowerCase().trim() === 'activa',
    creadoEn: f.created_at,
  }
}

/* Un titulo legible: la fuente no lo tiene, y "Apartamento" a secas no
   distingue una publicacion de otra en una rejilla de 82. */
function tituloDe(f: FilaRental): string {
  const tipo = f.property_type?.trim() || 'Vivienda'
  const donde = limpio(f.neighborhood) ?? limpio(f.municipality)
  return donde ? `${tipo} en ${donde}` : tipo
}

function aAlojamiento(f: FilaRental): Alojamiento {
  return {
    id: `pu-${f.id}`,
    origen: 'pereira-unida',
    titulo: tituloDe(f),
    descripcion: limpio(f.address),
    tipo: f.property_type?.trim() || 'Otro',
    ciudad: limpio(f.municipality) ?? 'Sin ciudad',
    departamento: limpio(f.department),
    barrio: limpio(f.neighborhood),
    direccion: limpio(f.address),
    precioMes: f.monthly_rent && f.monthly_rent > 0 ? f.monthly_rent : null,
    precioEnTexto: null,
    amoblado: f.furnished,
    habitaciones: null,
    banos: null,
    parqueaderos: null,
    areaM2: null,
    disponible: (f.status ?? 'disponible').toLowerCase().trim() === 'disponible',
    lat: f.lat,
    lng: f.lng,
    fotos: Array.isArray(f.photo_urls) ? f.photo_urls.filter(Boolean) : [],
    telefono: limpio(f.contact),
    contactos: null,
    publicadoEn: f.submitted_at ?? f.created_at,
  }
}

function aComentario(f: FilaComentario): ComentarioPeticion {
  return {
    id: f.id,
    peticionId: f.report_id,
    autor: limpio(f.author_name),
    texto: limpio(f.content) ?? '',
    creadoEn: f.created_at,
  }
}

/* --------------------------- Daños de servicios ---------------------------- */

/**
 * Cómo se llama cada daño en pantalla.
 *
 * La tabla no trae título: trae `service` y `severity`, y el título hay que
 * componerlo. Se hace con una rejilla explícita de quince frases en vez de
 * pegar palabras, porque las combinaciones no son simétricas —"Sector sin
 * postes" no significa nada— y porque un título es lo único que mucha gente va
 * a leer de este reporte.
 *
 * La severidad manda en la redacción y no al revés: la diferencia entre un
 * barrio entero sin agua y la acometida de una casa cambia qué hace quien lo
 * lee, y es justo lo que su API distingue.
 */
const TITULO_SERVICIO: Record<string, Record<string, string>> = {
  energia: {
    peligro_critico: 'Cable de energía caído o con corriente',
    corte_sector: 'Sector sin energía',
    falla_puntual: 'Falla de energía en una vivienda',
  },
  poste: {
    peligro_critico: 'Poste a punto de caer',
    corte_sector: 'Postes caídos en el sector',
    falla_puntual: 'Poste dañado',
  },
  agua: {
    peligro_critico: 'Daño grave en la red de agua',
    corte_sector: 'Sector sin agua',
    falla_puntual: 'Falla de agua en una vivienda',
  },
  gas: {
    peligro_critico: 'Escape o daño grave de gas',
    corte_sector: 'Sector sin gas',
    falla_puntual: 'Falla de gas en una vivienda',
  },
  internet: {
    peligro_critico: 'Cables de internet caídos',
    corte_sector: 'Sector sin internet',
    falla_puntual: 'Falla de internet en una vivienda',
  },
}

/**
 * Solo `peligro_critico` es una gravedad.
 *
 * Su documentación lo define como "cable vivo o poste cayéndose", que es
 * exactamente lo que pone en riesgo a quien pase por ahí. Las otras dos dicen a
 * cuánta gente afecta —un barrio, una casa—, no cómo de peligroso es; convertir
 * "el barrio se quedó sin agua" en "riesgo medio" pintaría una alarma que la
 * fuente no puso, del mismo modo que ya se evita con `risk: "road"` en la otra.
 * El alcance no se pierde: lo dice el título.
 */
const GRAVEDAD_SERVICIO: Record<string, GravedadAfectacion> = {
  peligro_critico: 'alta',
  corte_sector: 'sin-clasificar',
  falla_puntual: 'sin-clasificar',
}

/** Dirección y municipio en una línea. Esta fuente cubre Risaralda entera, así
    que el municipio no sobra: distingue una carrera 8 de otra. */
function direccionDe(f: FilaServicio): string | null {
  return [limpio(f.address), limpio(f.municipality)].filter(Boolean).join(', ') || null
}

function aAfectacionServicio(f: FilaServicio): Afectacion {
  const servicio = (f.service ?? '').toLowerCase().trim()
  const severidad = (f.severity ?? '').toLowerCase().trim()

  /* Un servicio o una severidad que no conozcamos NO tumba el reporte: un daño
     que no sabemos nombrar sigue siendo un daño, y borrarlo del mapa es peor
     que enseñarlo con un título genérico. */
  const titulo = TITULO_SERVICIO[servicio]?.[severidad] ?? 'Daño en un servicio público'

  return {
    id: `pu-${f.id}`,
    origen: 'pereira-unida',
    tipo: 'servicio-publico',
    gravedad: GRAVEDAD_SERVICIO[severidad] ?? 'sin-clasificar',
    titulo,
    subtipo: null,
    nota: limpio(f.description),
    direccion: direccionDe(f),
    lat: f.lat,
    lng: f.lng,
    /* Sin filas que mirar no se ha podido comprobar si las URLs son absolutas,
       así que se filtra lo vacío y nada más: la ficha ya sabe no enseñar nada
       cuando la lista queda a cero. */
    fotos: Array.isArray(f.photo_urls) ? f.photo_urls.filter(Boolean) : [],
    /* Esta tabla no tiene votos: no hay nada que contar y un cero inventado se
       leería como "nadie lo cree". La ficha ya dice "todavía nadie lo ha
       confirmado", que aquí es literalmente cierto. */
    confirmaciones: 0,
    balance: 0,
    reportadaEn: f.created_at,
  }
}

export const pereiraUnida: Backend = {
  descripcion: {
    id: 'pereira-unida',
    nombre: 'Pereira Unida',
    tipo: 'Tablón de la comunidad',
    descripcion:
      'Vecinos que piden ayuda y vecinos que se ofrecen, con su teléfono; y los daños de luz, agua, gas e internet.',
    quienPublica: 'Cualquier persona, sin registrarse.',
    url: 'https://pereiraunida.com',
    capacidades: [
      'leer:peticiones-persona',
      'leer:ofrecimientos-persona',
      'leer:comentarios',
      'leer:alojamientos',
      'leer:afectaciones',
      'escribir:afectacion',
    ],
  },

  leer: {
    async peticionesPersona(): Promise<PeticionPersona[]> {
      const filas = await leer<FilaReporte>('reports', COLUMNAS_REPORTE, (q) =>
        (q as unknown as { order: (c: string, o: object) => unknown }).order('created_at', {
          ascending: false,
        }),
      )
      return filas.map(aPeticion)
    },

    async ofrecimientosPersona(): Promise<OfrecimientoPersona[]> {
      const filas = await leer<FilaOferta>('help_offers', COLUMNAS_OFERTA, (q) =>
        (q as unknown as { order: (c: string, o: object) => unknown }).order('created_at', {
          ascending: false,
        }),
      )
      return filas.map(aOfrecimiento)
    },

    async alojamientos(): Promise<Alojamiento[]> {
      const filas = await leer<FilaRental>('rentals', COLUMNAS_RENTAL, (q) =>
        (q as unknown as { order: (c: string, o: object) => unknown }).order('created_at', {
          ascending: false,
        }),
      )
      return filas.map(aAlojamiento)
    },

    async comentarios(): Promise<ComentarioPeticion[]> {
      const filas = await leer<FilaComentario>('comments', COLUMNAS_COMENTARIO)
      return filas.map(aComentario)
    },

    /**
     * Daños de energía, postes, agua, gas e internet.
     *
     * Segunda fuente del terreno, y la que completa a la otra: Pereira Responde
     * dice qué edificio está tocado y por qué calle no se pasa; esta dice qué
     * barrio se quedó sin luz y dónde hay un cable en el suelo. Las dos caben en
     * la misma pantalla porque hablan de lo mismo —el estado de la ciudad— y
     * ninguna cubre lo de la otra.
     *
     * `resuelto` se descarta **en la consulta**: un daño ya atendido no es un
     * peligro y dejarlo mandaría una cuadrilla a un poste que ya levantaron. Se
     * usa `neq` y no una lista blanca a propósito: si mañana aparece un estado
     * que no conocemos, preferimos enseñarlo de más que esconder un cable vivo
     * porque su etiqueta es nueva.
     */
    async afectaciones(): Promise<Afectacion[]> {
      const filas = await leer<FilaServicio>('service_outages', COLUMNAS_SERVICIO, (q) =>
        (
          q as unknown as {
            neq: (c: string, v: string) => { order: (c: string, o: object) => unknown }
          }
        )
          .neq('status', 'resuelto')
          .order('created_at', { ascending: false }),
      )
      return filas.map(aAfectacionServicio)
    },
  },

  escribir: {},
}

/* ------------------------------ Publicar ---------------------------------- */

/**
 * Vocabulario de Corag → vocabulario de este tablón.
 *
 * Publicar con una categoría que la fuente no usa deja la petición fuera de sus
 * propios filtros: la ve quien mire la lista entera y nadie más. Estas son las
 * nueve etiquetas que aparecen en sus 282 reportes, no las que nos gustaría.
 */
const CATEGORIA_DESDE_CORAG: Record<string, string> = {
  alimentos: 'alimentos',
  agua: 'alimentos',
  salud: 'medicinas',
  medicamentos: 'medicinas',
  herramientas: 'herramientas',
  rescate: 'herramientas_rescate',
  transporte: 'transporte_logistica',
  acopio: 'voluntariado',
  voluntariado: 'voluntariado',
  mascotas: 'mascotas',
  refugio: 'otros',
  otro: 'otros',
}

export interface BorradorReporte {
  titulo: string
  descripcion: string
  /** Categoría en el vocabulario de Corag; aquí se traduce. */
  categoria: string
  urgente: boolean
  municipio: string
  departamento: string
  lugar: string
  lat: number | null
  lng: number | null
  telefono: string
}

/**
 * Publica la misma petición también en este tablón.
 *
 * Es una escritura de mejor esfuerzo: quien la llama ya publicó en Corag y esto
 * solo amplía el alcance. El permiso está comprobado —un insert con identificador
 * inválido falla por el dato (22P02) y no por permisos (42501), sin crear fila—,
 * pero la red puede caerse igual: si falla, la petición original sigue publicada
 * y eso es lo que se le cuenta a la persona.
 */
export async function publicarReporte(b: BorradorReporte): Promise<void> {
  if (configuracionIncompleta) {
    throw new ErrorApp({
      mensaje: 'La aplicación no está bien configurada.',
      sugerencia: 'Avisa a soporte con este código.',
      codigo: 'PU-CFG0',
      reintentable: false,
    })
  }

  const { error } = await cliente.from('reports').insert({
    title: b.titulo.trim(),
    description: b.descripcion.trim() || '',
    category: CATEGORIA_DESDE_CORAG[b.categoria] ?? 'otros',
    urgent_level: b.urgente ? 'critico' : 'moderado',
    status: 'buscando',
    municipality: b.municipio.trim() || null,
    department: b.departamento.trim() || null,
    location_name: b.lugar.trim() || null,
    lat: b.lat,
    lng: b.lng,
    contact_phone: b.telefono.replace(/\D/g, ''),
    photo_urls: [],
  } as never)

  if (error) throw new ErrorApp(traducirError(error, 'PU'), error)
}

/* ------------------- Publicar un daño de servicio público ------------------ */

/** Vocabulario del dominio → el suyo. */
const SERVICIO_A_FUENTE: Record<ServicioAfectado, string> = {
  luz: 'energia',
  agua: 'agua',
  gas: 'gas',
  internet: 'internet',
  'poste-cable': 'poste',
}

export interface BorradorDanoServicio {
  servicio: ServicioAfectado
  /** Se ignora en `poste-cable`: ahí la severidad la fija el propio daño. */
  alcance: AlcanceServicio
  nota: string
  lat: number
  lng: number
}

/**
 * Publica el mismo daño también en el tablón de cuadrillas de Pereira Unida.
 *
 * Es una escritura de mejor esfuerzo, igual que la de `reports`: quien la llama
 * ya publicó en Pereira Responde y esto solo amplía a quién le llega. Si falla,
 * el reporte original sigue publicado y eso es lo que se le cuenta a la persona;
 * decirle "no se pudo publicar" cuando sí se pudo la mandaría a repetirlo todo
 * desde la calle.
 *
 * Y aquí amplía de verdad: ese endpoint está pensado para el tablero de una
 * cuadrilla —el de Energía de Pereira, dice su propia documentación—, así que un
 * cable en el suelo llega a quien puede ir a quitarlo, no solo a quien pasa por
 * la acera.
 *
 * Tres cosas que NO se mandan, y por qué:
 *
 * - **Las fotos.** Su columna guarda URLs, no bytes, y subir a su almacenamiento
 *   es un permiso que no tenemos. La evidencia se queda en Pereira Responde, que
 *   sí la recibe entera.
 * - **`municipality` y `department`.** No se preguntan en el formulario y el
 *   catálogo local solo tiene centroides: Pereira y Dosquebradas están pegadas,
 *   y etiquetar como "Pereira" un poste de Dosquebradas manda una cuadrilla al
 *   municipio equivocado. Se manda vacío, que es la verdad. El coste está
 *   medido: su filtro `?municipio=` no encontrará estos reportes, pero el
 *   `lat`/`lng` —lo único que su documentación llama obligatorio, "sin
 *   coordenadas exactas una cuadrilla no puede ubicar el punto"— va exacto.
 * - **`address`.** Por lo mismo: no la pedimos, y meter ahí la nota sería repetir
 *   el error que ya cuesta un comentario entero explicar en la otra fuente.
 *
 * **Sin verificar de extremo a extremo.** El `GRANT` de `INSERT` está comprobado
 * —un insert con identificador inválido responde 22P02 y no 42501, sin crear
 * fila—, pero la tabla tiene cero filas y comprobar que una inserción completa
 * pasa exigiría dejar un daño falso en la base de datos de una emergencia ajena.
 * Por eso esto es de mejor esfuerzo y su fallo nunca arrastra al reporte
 * principal.
 */
export async function publicarDanoServicio(b: BorradorDanoServicio): Promise<void> {
  if (configuracionIncompleta) {
    throw new ErrorApp({
      mensaje: 'La aplicación no está bien configurada.',
      sugerencia: 'Avisa a soporte con este código.',
      codigo: 'PU-CFG0',
      reintentable: false,
    })
  }

  const service = SERVICIO_A_FUENTE[b.servicio]
  /* Un poste o un cable caído ES el peligro que su escala llama crítico ("cable
     vivo o poste cayéndose"): no hace falta preguntarlo. En los cortes, en
     cambio, la severidad es el alcance, y eso solo lo sabe quien reporta. */
  const severity =
    b.servicio === 'poste-cable'
      ? 'peligro_critico'
      : b.alcance === 'sector'
        ? 'corte_sector'
        : 'falla_puntual'

  const { error } = await cliente.from('service_outages').insert({
    service,
    severity,
    /* Sin nota se manda la misma frase que la aplicación pinta para esa
       combinación, no una cadena vacía: al otro lado hay un tablero donde una
       fila sin descripción no dice ni qué se rompió. */
    description: b.nota.trim() || (TITULO_SERVICIO[service]?.[severity] ?? 'Daño en un servicio público'),
    address: null,
    municipality: null,
    department: null,
    lat: b.lat,
    lng: b.lng,
    photo_urls: [],
    status: 'reportado',
  } as never)

  if (error) throw new ErrorApp(traducirError(error, 'PU'), error)
}
