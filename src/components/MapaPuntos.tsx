import { useMemo, useState, type KeyboardEvent } from 'react'
import type { Origen } from './Fuente'

/**
 * Mapa de posiciones sin librería, sin tiles y sin red.
 *
 * No dibuja calles: dibuja quién está dónde, unos respecto a otros. Es
 * deliberado. Un mapa con tiles pide decenas de imágenes a un CDN, y en una
 * emergencia la red móvil es lo primero que se cae; el mapa que no carga es
 * peor que ninguno porque deja un rectángulo gris en medio de la pantalla.
 *
 * La proyección es equirectangular con corrección por coseno de la latitud. A
 * escala de un municipio el error es despreciable, y sin la corrección el Eje
 * Cafetero (4,8° N) saldría estirado un 0,4% en horizontal — invisible, pero
 * hacerlo bien cuesta una línea.
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

const MARGEN = 0.08

interface Props {
  puntos: PuntoMapa[]
  /** Se pinta distinto y nunca se recorta del encuadre. */
  yoEstoyAqui?: { lat: number; lng: number } | null
  alto?: number
}

export function MapaPuntos({ puntos, yoEstoyAqui = null, alto }: Props) {
  const [activo, setActivo] = useState<string | null>(null)

  const proyectados = useMemo(() => {
    const todos = [...puntos.map((p) => ({ lat: p.lat, lng: p.lng }))]
    if (yoEstoyAqui) todos.push(yoEstoyAqui)
    if (todos.length === 0) return null

    const lats = todos.map((p) => p.lat)
    const lngs = todos.map((p) => p.lng)
    let minLat = Math.min(...lats)
    let maxLat = Math.max(...lats)
    let minLng = Math.min(...lngs)
    let maxLng = Math.max(...lngs)

    // Un solo punto (o todos en el mismo sitio) da un rango cero y la división
    // explota. Se abre una ventana mínima de ~1 km alrededor.
    const RANGO_MIN = 0.01
    if (maxLat - minLat < RANGO_MIN) {
      const c = (maxLat + minLat) / 2
      minLat = c - RANGO_MIN / 2
      maxLat = c + RANGO_MIN / 2
    }
    if (maxLng - minLng < RANGO_MIN) {
      const c = (maxLng + minLng) / 2
      minLng = c - RANGO_MIN / 2
      maxLng = c + RANGO_MIN / 2
    }

    const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
    const anchoGeo = (maxLng - minLng) * cosLat
    const altoGeo = maxLat - minLat

    // Se conserva la relación de aspecto real: el eje mayor manda y el menor se
    // centra. Si no, las distancias del dibujo mentirían.
    const escala = Math.max(anchoGeo, altoGeo)
    const desplazX = (escala - anchoGeo) / 2
    const desplazY = (escala - altoGeo) / 2

    const aXY = (lat: number, lng: number) => ({
      x: MARGEN + ((lng - minLng) * cosLat + desplazX) / escala * (1 - MARGEN * 2),
      y: MARGEN + (1 - (lat - minLat + desplazY) / escala) * (1 - MARGEN * 2),
    })

    return {
      puntos: puntos.map((p) => ({ ...p, ...aXY(p.lat, p.lng) })),
      yo: yoEstoyAqui ? aXY(yoEstoyAqui.lat, yoEstoyAqui.lng) : null,
    }
  }, [puntos, yoEstoyAqui])

  if (!proyectados) return null

  const seleccionado = proyectados.puntos.find((p) => p.id === activo) ?? null

  return (
    <div>
      <div className="mapa" style={alto ? { aspectRatio: 'auto', height: alto } : undefined}>
        <svg
          className="mapa__svg"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label={`Mapa con ${proyectados.puntos.length} ubicaciones`}
        >
          {/* Retícula: da sensación de escala sin fingir que son calles. */}
          <g opacity="0.5">
            {[0, 250, 500, 750, 1000].map((v) => (
              <g key={v}>
                <line x1={v} y1="0" x2={v} y2="1000" stroke="var(--border)" strokeWidth="1" />
                <line x1="0" y1={v} x2="1000" y2={v} stroke="var(--border)" strokeWidth="1" />
              </g>
            ))}
          </g>

          {proyectados.yo && (
            <g>
              <circle
                cx={proyectados.yo.x * 1000}
                cy={proyectados.yo.y * 1000}
                r="22"
                fill="var(--info)"
                opacity="0.18"
              />
              <circle
                cx={proyectados.yo.x * 1000}
                cy={proyectados.yo.y * 1000}
                r="8"
                fill="var(--info)"
                stroke="var(--surface)"
                strokeWidth="3"
              />
            </g>
          )}

          {proyectados.puntos.map((p) => {
            /* Los dos colores de marca —amarillo y lima— son vecinos en el tono
               y mucha gente no los separa. La forma sí se distingue siempre:
               cuadrado para un sitio fijo, círculo para una persona. El color
               acompaña, no es lo que carga la información. */
            const r = p.destacado ? 11 : 8
            const comun = {
              className: 'mapa__punto',
              fill: p.origen === 'corag' ? 'var(--lima)' : 'var(--brand)',
              /* Semitransparentes a propósito: en una ciudad hay decenas de
                 puntos casi encima, y opacos se tapan unos a otros hasta
                 parecer uno solo. Así el amontonamiento se ve más oscuro y
                 se lee como lo que es: mucha gente en la misma manzana. */
              fillOpacity: 0.72,
              stroke: p.id === activo ? 'var(--text)' : 'var(--border-strong)',
              strokeWidth: p.id === activo ? 3 : 1.2,
              tabIndex: 0,
              role: 'button',
              'aria-label': p.titulo,
              onMouseEnter: () => setActivo(p.id),
              onFocus: () => setActivo(p.id),
              onClick: () => (p.alPulsar ? p.alPulsar() : setActivo(p.id)),
              onKeyDown: (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  p.alPulsar?.()
                }
              },
            }

            return p.origen === 'corag' ? (
              <circle key={p.id} cx={p.x * 1000} cy={p.y * 1000} r={r} {...comun} />
            ) : (
              <rect
                key={p.id}
                x={p.x * 1000 - r}
                y={p.y * 1000 - r}
                width={r * 2}
                height={r * 2}
                rx={r / 2.5}
                {...comun}
              />
            )
          })}
        </svg>
      </div>

      {/* El detalle va FUERA del svg: dentro tendría que reimplementar el
          recorte de texto a mano y en 375px no cabe de ninguna manera. */}
      <div
        className="panel"
        style={{ marginTop: 'var(--sp-3)', minHeight: '4.25rem', padding: 'var(--sp-3)' }}
        aria-live="polite"
      >
        {seleccionado ? (
          <>
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
          </>
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
            <i className="mapa__punto-leyenda" style={{ background: 'var(--info)' }} />
            Estás aquí
          </span>
        )}
      </div>
    </div>
  )
}
