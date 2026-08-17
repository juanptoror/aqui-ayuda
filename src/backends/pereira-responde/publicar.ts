import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import type { FotoPreparada } from '@/lib/imagenes'
import type { GravedadAfectacion, TipoAfectacion } from '@/dominio/modelos'

/**
 * Publicar un daño.
 *
 * El navegador NO habla con Pereira Responde aquí. Su endpoint de escritura pide
 * `Authorization: Bearer <API_KEY>` y su documentación dice literalmente "nunca
 * publiques la clave en JavaScript del navegador", así que el envío pasa por
 * nuestra propia función de servidor ([api/reportes.ts](/api/reportes.ts)), que
 * es la única que ve la clave. Desde aquí solo se ve `/api/reportes`.
 *
 * La lectura sigue yendo directa a la fuente, sin intermediario: es pública, no
 * necesita clave y meterla por nuestro servidor solo añadiría un punto de fallo
 * entre alguien y el mapa de peligros de su barrio.
 */

const RUTA = '/api/reportes'

/* --------------------------- Vocabulario de la fuente ---------------------- */

export const TIPO_A_FUENTE: Record<TipoAfectacion, 'housing' | 'road' | 'support' | 'utility'> = {
  vivienda: 'housing',
  via: 'road',
  apoyo: 'support',
  'servicio-publico': 'utility',
}

/**
 * Las clases de daño que ofrece cada tipo.
 *
 * Son las de su propio formulario, no las que nos gustaría. Publicar con un
 * título inventado deja el reporte fuera de sus filtros: lo vería quien mire la
 * lista entera y nadie más. Las de vivienda salen de su desplegable —cinco,
 * incluida "Daño menor visible", que aún no aparece en ningún reporte
 * publicado— y las de vía y servicio, de los títulos que sí están en sus datos.
 *
 * Las de servicio público son el único caso donde no se pudo copiar la lista:
 * su formulario todavía no ofrece este tipo en la web y en sus datos hay un
 * solo reporte, "Sin servicio de internet". Las otras cuatro siguen ese mismo
 * molde sobre los servicios que su propio contrato enumera —«luz, agua, gas,
 * internet, postes»—, así que son la lista de la fuente escrita a partir de su
 * documentación, no un invento nuestro. Si mañana publican su desplegable, se
 * copia de ahí y esta nota sobra.
 */
export const CLASES_POR_TIPO: Record<TipoAfectacion, readonly string[]> = {
  vivienda: [
    'Grietas en muros, columnas o vigas',
    'Desprendimiento de fachada o techo',
    'Inclinación, hundimiento o colapso parcial',
    'Colapso total',
    'Daño menor visible',
  ],
  via: ['Vía cerrada por derrumbe o inundación', 'Paso restringido'],
  apoyo: ['Refugio temporal', 'Zona de acopio'],
  'servicio-publico': [
    'Sin servicio de luz',
    'Sin servicio de agua',
    'Sin servicio de gas',
    'Sin servicio de internet',
    'Poste o cable caído',
  ],
}

/**
 * ¿Este tipo exige foto?
 *
 * El contrato la pide en `housing`, `road` y `support` y la deja opcional en
 * `utility` (`photos.minItems: 0`), y tiene sentido: un corte de luz no se
 * fotografía. Exigirla igual sería inventarnos un requisito que la fuente no
 * tiene y dejar sin publicar a quien está a oscuras justamente porque no puede
 * enseñar nada.
 */
export function exigeFoto(tipo: TipoAfectacion): boolean {
  return tipo !== 'servicio-publico'
}

/** `category`, obligatoria solo en los servicios abiertos. */
export const CATEGORIAS_APOYO = [
  { valor: 'shelter', texto: 'Refugio' },
  { valor: 'collection', texto: 'Zona de acopio' },
  { valor: 'hospital', texto: 'Hospital' },
  { valor: 'pharmacy', texto: 'Farmacia' },
  { valor: 'store', texto: 'Tienda' },
  { valor: 'supplies', texto: 'Suministros' },
  { valor: 'veterinary', texto: 'Veterinaria' },
] as const

export type CategoriaApoyo = (typeof CATEGORIAS_APOYO)[number]['valor']

export const MAX_FOTOS = 3
export const MAX_NOTA = 1000

/* -------------------------------- Publicar --------------------------------- */

export interface BorradorAfectacion {
  tipo: TipoAfectacion
  /** Solo se usa en vivienda: los otros tipos llevan el riesgo fijado. */
  gravedad: Extract<GravedadAfectacion, 'alta' | 'media'>
  /** Una de `CLASES_POR_TIPO[tipo]`. */
  clase: string
  /** Obligatoria en `apoyo`, ignorada en el resto. */
  categoria: CategoriaApoyo | null
  nota: string
  lat: number
  lng: number
  fotos: FotoPreparada[]
}

/**
 * `risk` no es libre: la fuente devuelve 400 si la combinación no encaja.
 * `housing` admite alto o medio; `road`, `support` y `utility` repiten su
 * propio tipo dentro del campo, que es la rareza que ya obliga a decir "sin
 * clasificar" al leer.
 */
function riesgoDe(b: BorradorAfectacion): 'high' | 'medium' | 'road' | 'support' | 'utility' {
  if (b.tipo === 'via') return 'road'
  if (b.tipo === 'apoyo') return 'support'
  if (b.tipo === 'servicio-publico') return 'utility'
  return b.gravedad === 'alta' ? 'high' : 'medium'
}

export interface ReporteCreado {
  id: string
}

export function usePublicarAfectacion() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (b: BorradorAfectacion): Promise<ReporteCreado> => {
      const cuerpo = {
        type: TIPO_A_FUENTE[b.tipo],
        category: b.tipo === 'apoyo' ? b.categoria : null,
        risk: riesgoDe(b),
        title: b.clase,
        note: b.nota.trim() || null,
        coords: [b.lat, b.lng],
        photos: b.fotos.map((f) => ({ contentType: f.contentType, data: f.data })),
      }

      const r = await fetch(RUTA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(cuerpo),
      })

      const texto = await r.text()
      if (!r.ok) {
        /* El proxy ya traduce los errores de la fuente a algo accionable. Se
           enseña ese mensaje tal cual en lugar de un "algo salió mal": quien
           está en la calle frente a un edificio agrietado necesita saber si
           reintentar o irse a la fuente. */
        let detalle = 'No se pudo publicar el reporte.'
        try {
          detalle = (JSON.parse(texto) as { error?: string }).error ?? detalle
        } catch {
          /* la respuesta de error no era JSON */
        }
        throw new Error(detalle)
      }

      return texto ? (JSON.parse(texto) as ReporteCreado) : { id: '' }
    },

    /* El mapa de daños tiene que enseñar el reporte recién publicado sin que
       nadie recargue: si alguien acaba de avisar de una vía cortada y su propio
       aviso no aparece, lo natural es pensar que no se envió y mandarlo otra vez. */
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['afectaciones'] })
    },
  })
}

/**
 * ¿Se puede publicar desde esta instalación?
 *
 * La respuesta depende de si el servidor tiene configurada la clave, y eso el
 * navegador no puede saberlo solo. Se pregunta antes de ofrecer el formulario:
 * enseñar uno que falla al enviar sería la peor forma de descubrir que la
 * integración no está montada, y encima después de que alguien haya subido una
 * foto desde la calle.
 */
export function useSePuedePublicar(): UseQueryResult<boolean> {
  return useQuery({
    queryKey: ['pereira-responde', 'puede-publicar'],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const r = await fetch(RUTA, { signal, headers: { Accept: 'application/json' } })
      if (!r.ok) return false
      const j = (await r.json()) as { disponible?: boolean }
      return !!j.disponible
    },
  })
}
