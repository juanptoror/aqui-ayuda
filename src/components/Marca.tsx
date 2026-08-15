/**
 * Logo de AquíAyuda: pin de mapa con el monograma AA.
 *
 * Va como SVG inline y no como imagen por dos razones: hereda el color del
 * contexto (el kit lo usa negro sobre claro, amarillo sobre oscuro y negro
 * sobre amarillo) y no añade una petición de red que en una emergencia puede
 * no llegar.
 */
export function PinAA({
  size = 28,
  colorPin = 'currentColor',
  colorLetras,
  title,
}: {
  size?: number
  colorPin?: string
  /** Color del monograma. Por defecto, el hueco del pin queda transparente. */
  colorLetras?: string
  title?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* Gota: círculo arriba y punta abajo, como en el brand kit. */}
      <path
        d="M24 3c-8.284 0-15 6.716-15 15 0 10.5 12.03 24.62 14.03 26.9a1.3 1.3 0 0 0 1.94 0C27.97 42.62 40 28.5 40 18c0-8.284-6.716-15-16-15Z"
        fill={colorPin}
      />
      {/* Monograma AA: dos aes de palo, sin travesaño, tal como el kit. */}
      <path
        d="M14.3 24.5 18.4 12h3.1l4.1 12.5h-3.05l-.72-2.4h-3.9l-.72 2.4H14.3Zm3.42-4.65h2.6l-1.3-4.3-1.3 4.3ZM26.4 24.5 30.5 12h3.1l4.1 12.5h-3.05l-.72-2.4h-3.9l-.72 2.4H26.4Zm3.42-4.65h2.6l-1.3-4.3-1.3 4.3Z"
        fill={colorLetras ?? 'var(--on-brand)'}
      />
    </svg>
  )
}

/** Colores de pin por ciudad, tal como los define el brand kit. */
export const COLOR_PIN_CIUDAD: Record<string, string> = {
  'pereira-2': 'var(--amarillo)',
  pereira: 'var(--amarillo)',
  cali: 'var(--lima)',
  manizales: 'var(--naranja)',
  'bogota-d-c': 'var(--rojo)',
}

export function colorPinDe(slug: string | undefined): string {
  if (!slug) return 'var(--amarillo)'
  return COLOR_PIN_CIUDAD[slug] ?? 'var(--amarillo)'
}
