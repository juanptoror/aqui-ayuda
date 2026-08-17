import { useMemo, type KeyboardEvent } from 'react'
import { formaDe, type PropsCapaMapa } from './MapaPuntos'

/**
 * El mapa que siempre carga: posiciones dibujadas en el dispositivo, sin
 * librería, sin tiles y sin red.
 *
 * Ya no es lo que se ve normalmente —encima va el mapa real de Leaflet— pero
 * sigue siendo la primera capa que se pinta y la única que queda cuando la red
 * falla. En una emergencia la red móvil es lo primero que se cae, y un mapa que
 * no carga es peor que ninguno porque deja un rectángulo gris en medio de la
 * pantalla.
 *
 * No dibuja calles: dibuja quién está dónde, unos respecto a otros. La
 * proyección es equirectangular con corrección por coseno de la latitud. A
 * escala de un municipio el error es despreciable, y sin la corrección el Eje
 * Cafetero (4,8° N) saldría estirado un 0,4% en horizontal — invisible, pero
 * hacerlo bien cuesta una línea.
 */

const MARGEN = 0.08

export function MapaEsquema({ puntos, yoEstoyAqui, activo, alActivar }: PropsCapaMapa) {
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

  return (
    <svg
      className="mapa__svg"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
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
            fill="var(--mapa-yo)"
            opacity="0.18"
          />
          <circle
            cx={proyectados.yo.x * 1000}
            cy={proyectados.yo.y * 1000}
            r="8"
            fill="var(--mapa-yo)"
            stroke="var(--surface)"
            strokeWidth="3"
          />
        </g>
      )}

      {proyectados.puntos.map((p) => {
        /* Los colores de marca son vecinos en el tono y mucha gente no los
           separa. La forma sí se distingue siempre; el criterio está en
           `formaDe` para que esta capa y la de tiles no puedan discrepar. */
        const forma = formaDe(p)
        const r = p.destacado ? 11 : 8
        const comun = {
          className: `mapa__punto mapa__punto--${forma === 'persona' ? 'persona' : forma === 'dano' ? 'dano' : 'sitio'}${
            p.id === activo ? ' is-activo' : ''
          }`,
          fill:
            forma === 'persona'
              ? 'var(--lima)'
              : forma === 'dano'
                ? 'var(--rojo)'
                : 'var(--brand)',
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
          onMouseEnter: () => alActivar(p.id),
          onFocus: () => alActivar(p.id),
          onClick: () => alActivar(p.id),
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              alActivar(p.id)
            }
          },
        }

        const cx = p.x * 1000
        const cy = p.y * 1000

        if (forma === 'persona') {
          return <circle key={p.id} cx={cx} cy={cy} r={r} {...comun} />
        }

        if (forma === 'dano') {
          /* Círculo rojo con el anillo claro dentro. El anillo va como segundo
             elemento y NO es interactivo: si lo fuera se comería los eventos
             del punto que tiene debajo y el toque no seleccionaría nada. */
          return (
            <g key={p.id}>
              <circle cx={cx} cy={cy} r={r} {...comun} />
              <circle
                cx={cx}
                cy={cy}
                r={r * 0.42}
                fill="var(--surface)"
                opacity="0.9"
                pointerEvents="none"
              />
            </g>
          )
        }

        return (
          <rect
            key={p.id}
            x={cx - r}
            y={cy - r}
            width={r * 2}
            height={r * 2}
            rx={r / 2.5}
            {...comun}
          />
        )
      })}
    </svg>
  )
}
