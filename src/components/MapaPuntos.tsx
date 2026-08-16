import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import type { Coordenada } from '@/dominio/modelos'
import { usePreferencias } from '@/state/preferencias'
import type { Origen } from './Fuente'
import { ComoLlegar } from './ComoLlegar'
import { MapaEsquema } from './MapaEsquema'

/**
 * El mapa de la aplicación, en dos capas.
 *
 * Abajo, el esquema: posiciones calculadas y dibujadas en el dispositivo, sin
 * red. Se pinta en el primer fotograma, siempre.
 *
 * Encima, el mapa de verdad: calles y barrios de OpenStreetMap con Leaflet,
 * que llega en un `import()` aparte y funde sobre el esquema cuando el primer
 * tile está en pantalla. Si no llega —red caída, CDN bloqueado, avión— se
 * retira y abajo sigue estando el esquema.
 *
 * El orden importa: primero lo que no puede fallar, después lo que es mejor.
 * Al revés habría un rectángulo gris durante la espera, y en una emergencia
 * eso es exactamente lo que no se puede permitir.
 *
 * La ficha del punto seleccionado y la leyenda viven aquí, fuera de las dos
 * capas, para que cambiar de capa no cambie nada de lo que se lee.
 */

export interface PuntoMapa {
  id: string
  lat: number
  lng: number
  titulo: string
  detalle?: string
  origen: Origen
  /** Resalta el punto: peticiones urgentes, centro seleccionado. */
  destacado?: boolean
  alPulsar?: () => void
}

/** Lo que necesita cualquiera de las dos capas para dibujar lo mismo. */
export interface PropsCapaMapa {
  puntos: PuntoMapa[]
  yoEstoyAqui: Coordenada | null
  activo: string | null
  alActivar: (id: string) => void
}

interface Props {
  puntos: PuntoMapa[]
  /** Se pinta distinto y nunca se recorta del encuadre. */
  yoEstoyAqui?: Coordenada | null
  alto?: number
}

/** Lo que dura el fundido de la capa de tiles, en la hoja de estilos. */
const FUNDIDO_MS = 320

export function MapaPuntos({ puntos, yoEstoyAqui = null, alto }: Props) {
  const { tema } = usePreferencias()
  const [activo, setActivo] = useState<string | null>(null)

  const [Tiles, setTiles] = useState<ComponentType<
    PropsCapaMapa & { tema: 'light' | 'dark'; alEstarListo: () => void; alFallar: () => void }
  > | null>(null)
  const [sinTiles, setSinTiles] = useState(false)
  const [esquemaVisible, setEsquemaVisible] = useState(true)
  const relojRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    // Sin red no se intenta siquiera: se ahorra la petición y el parpadeo.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSinTiles(true)
      return
    }
    let vivo = true
    import('./MapaTiles')
      .then((m) => {
        if (vivo) setTiles(() => m.MapaTiles)
      })
      .catch(() => {
        // El trozo de Leaflet no bajó. El esquema ya está en pantalla.
        if (vivo) setSinTiles(true)
      })
    return () => {
      vivo = false
      window.clearTimeout(relojRef.current)
    }
  }, [])

  const alEstarListo = useCallback(() => {
    // El esquema se retira cuando el fundido ya lo tapa, no antes: si se
    // desmontase de golpe se vería el fondo del contenedor por debajo.
    window.clearTimeout(relojRef.current)
    relojRef.current = window.setTimeout(() => setEsquemaVisible(false), FUNDIDO_MS)
  }, [])

  const alFallar = useCallback(() => {
    setSinTiles(true)
    setEsquemaVisible(true)
  }, [])

  const seleccionado = puntos.find((p) => p.id === activo) ?? null

  return (
    <div>
      <div
        className="mapa"
        style={alto ? { aspectRatio: 'auto', height: alto } : undefined}
        role="group"
        aria-label={`Mapa con ${puntos.length} ubicaciones`}
      >
        {esquemaVisible && (
          <MapaEsquema
            puntos={puntos}
            yoEstoyAqui={yoEstoyAqui}
            activo={activo}
            alActivar={setActivo}
          />
        )}

        {Tiles && !sinTiles && (
          <Tiles
            puntos={puntos}
            yoEstoyAqui={yoEstoyAqui}
            activo={activo}
            alActivar={setActivo}
            tema={tema}
            alEstarListo={alEstarListo}
            alFallar={alFallar}
          />
        )}
      </div>

      {/* La ficha va FUERA del mapa: dentro tendría que reimplementar el
          recorte de texto a mano y en 375px no cabe de ninguna manera. */}
      <div
        className="panel"
        style={{ marginTop: 'var(--sp-3)', minHeight: '4.25rem', padding: 'var(--sp-3)' }}
        aria-live="polite"
      >
        {seleccionado ? (
          <div className="row row--wrap">
            <div className="min0" style={{ flex: '1 1 14rem' }}>
              <div className="truncate" style={{ fontWeight: 700 }}>
                {seleccionado.titulo}
              </div>
              {seleccionado.detalle && (
                <div
                  className="truncate"
                  style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}
                >
                  {seleccionado.detalle}
                </div>
              )}
            </div>
            {/* Antes, tocar un centro saltaba a su ficha y en el móvil nunca
                se llegaba a ver esta línea. Ahora el toque selecciona y desde
                aquí se decide: leer la ficha o ir al sitio. */}
            {seleccionado.alPulsar && (
              <button type="button" className="btn btn--sm" onClick={seleccionado.alPulsar}>
                <span>Ver ficha</span>
              </button>
            )}
            {/* Nuestro mapa dice quién está cerca de qué; para *llegar* hace
                falta la app del teléfono, con su tráfico y su voz. */}
            <ComoLlegar
              destino={{ lat: seleccionado.lat, lng: seleccionado.lng, nombre: seleccionado.titulo }}
              tamano="sm"
            />
          </div>
        ) : (
          <div style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
            Toca un punto para ver qué hay ahí.
          </div>
        )}
      </div>

      <div className="mapa__leyenda">
        <span>
          <i
            className="mapa__punto-leyenda"
            style={{ background: 'var(--brand)', borderRadius: '3px' }}
          />
          Centros de acopio (cuadrado)
        </span>
        <span>
          <i className="mapa__punto-leyenda" style={{ background: 'var(--lima)' }} />
          Personas que piden o dan (círculo)
        </span>
        {yoEstoyAqui && (
          <span>
            <i className="mapa__punto-leyenda" style={{ background: 'var(--mapa-yo)' }} />
            Estás aquí
          </span>
        )}
      </div>
    </div>
  )
}
