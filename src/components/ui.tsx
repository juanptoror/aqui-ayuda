import { useEffect, useRef, type ReactNode } from 'react'
import { AlertTriangle, Info, X, type LucideIcon } from 'lucide-react'
import { mensajeDe } from '@/lib/errores'

/* ------------------------------ Cabecera ---------------------------------- */

export function PageHeader({
  eyebrow,
  titulo,
  subtitulo,
  acciones,
  estrecho,
}: {
  eyebrow?: ReactNode
  titulo: string
  subtitulo?: ReactNode
  acciones?: ReactNode
  /** Alinea la cabecera con un contenido de lectura (container--narrow). */
  estrecho?: boolean
}) {
  return (
    <header className="page-header">
      <div className={estrecho ? 'container container--narrow' : 'container'}>
        <div className="page-header__inner">
          <div className="page-header__text">
            {eyebrow && <div className="page-header__eyebrow">{eyebrow}</div>}
            <h1 className="page-header__title">{titulo}</h1>
            {subtitulo && <p className="page-header__subtitle">{subtitulo}</p>}
          </div>
          {acciones && <div className="page-header__actions">{acciones}</div>}
        </div>
      </div>
    </header>
  )
}

/* -------------------------------- Badge ----------------------------------- */

type TonoBadge = 'critical' | 'warning' | 'success' | 'info' | 'brand' | 'neutral'

export function Badge({
  tono = 'neutral',
  icono: Icono,
  children,
  grande,
}: {
  tono?: TonoBadge
  icono?: LucideIcon
  children: ReactNode
  grande?: boolean
}) {
  return (
    <span className={`badge badge--${tono}${grande ? ' badge--lg' : ''}`}>
      {Icono && <Icono size={grande ? 14 : 12} strokeWidth={2.5} />}
      {children}
    </span>
  )
}

/* --------------------------------- KPI ------------------------------------ */

export function Kpi({
  etiqueta,
  valor,
  pista,
  icono: Icono,
  tono,
  cargando,
}: {
  etiqueta: string
  valor: ReactNode
  pista?: string
  icono: LucideIcon
  tono?: 'critical' | 'warning' | 'success' | 'brand'
  cargando?: boolean
}) {
  return (
    <div className={`kpi${tono ? ` kpi--${tono}` : ''}`}>
      <div className="kpi__top">
        <span className="kpi__icon">
          <Icono size={16} strokeWidth={2.25} />
        </span>
        <span className="kpi__label">{etiqueta}</span>
      </div>
      {cargando ? (
        <div className="skeleton" style={{ height: 34, width: '58%' }} />
      ) : (
        <div className="kpi__value">{valor}</div>
      )}
      {cargando ? (
        <div className="skeleton" style={{ height: 14, width: '80%' }} />
      ) : (
        <div className="kpi__hint">{pista ?? ' '}</div>
      )}
    </div>
  )
}

/* ----------------------------- Estado vacío -------------------------------- */

export function EmptyState({
  icono: Icono,
  titulo,
  texto,
  acciones,
  tono,
}: {
  icono: LucideIcon
  titulo: string
  texto: ReactNode
  acciones?: ReactNode
  tono?: 'critical' | 'warning'
}) {
  return (
    <div className={`empty${tono ? ` empty--${tono}` : ''}`}>
      <span className="empty__icon">
        <Icono size={26} strokeWidth={2} />
      </span>
      <h3 className="empty__title">{titulo}</h3>
      <p className="empty__text">{texto}</p>
      {acciones && <div className="empty__actions">{acciones}</div>}
    </div>
  )
}

/* -------------------------------- Aviso ----------------------------------- */

export function Notice({
  tono = 'info',
  icono: Icono,
  children,
  accion,
}: {
  tono?: 'info' | 'warning' | 'critical'
  icono?: LucideIcon
  children: ReactNode
  accion?: ReactNode
}) {
  const Fallback = tono === 'info' ? Info : AlertTriangle
  const I = Icono ?? Fallback
  return (
    <div className={`notice notice--${tono}`} role={tono === 'critical' ? 'alert' : 'status'}>
      <I size={17} strokeWidth={2.25} />
      <div className="notice__text">{children}</div>
      {accion}
    </div>
  )
}

/* --------------------------- Aviso de error ------------------------------- */

/**
 * Único sitio por el que un error llega a la pantalla.
 *
 * Muestra qué pasó y qué hacer, y el código corto para soporte. Nunca el
 * mensaje crudo: quien acaba de perder su casa no tiene por qué leer
 * "PostgREST 42501".
 */
export function AvisoError({
  error,
  origen,
  alReintentar,
}: {
  error: unknown
  origen?: 'AP' | 'CG' | 'APP'
  alReintentar?: () => void
}) {
  const info = mensajeDe(error, origen)
  return (
    <div className={`notice notice--${info.reintentable ? 'warning' : 'critical'}`} role="alert">
      <AlertTriangle size={17} strokeWidth={2.25} />
      <div className="notice__text">
        <strong>{info.mensaje}</strong> {info.sugerencia}{' '}
        <code className="codigo-soporte">{info.codigo}</code>
      </div>
      {info.reintentable && alReintentar && (
        <button type="button" className="btn btn--sm" onClick={alReintentar}>
          <span>Reintentar</span>
        </button>
      )}
    </div>
  )
}

/* ------------------------------ Sección ----------------------------------- */

export function SectionHead({
  titulo,
  conteo,
  acciones,
}: {
  titulo: string
  conteo?: ReactNode
  acciones?: ReactNode
}) {
  return (
    <div className="section__head">
      <h2 className="section__title">{titulo}</h2>
      {conteo != null && <span className="section__count">{conteo}</span>}
      <div className="spacer" />
      {acciones}
    </div>
  )
}

/* ------------------------- Diálogo / hoja inferior -------------------------- */
/* Escritorio: diálogo centrado. Móvil: hoja que sube desde abajo.
   Ambos son el MISMO componente; solo cambia la presentación por CSS. */

export function Sheet({
  abierta,
  alCerrar,
  titulo,
  subtitulo,
  children,
  pie,
}: {
  abierta: boolean
  alCerrar: () => void
  titulo: string
  subtitulo?: string
  children: ReactNode
  pie?: ReactNode
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const previo = useRef<HTMLElement | null>(null)

  /**
   * `alCerrar` suele llegar como función inline, así que cambia de identidad en
   * CADA render del padre. Si el efecto dependiera de ella, al escribir una
   * letra en un campo del diálogo el efecto se desmontaría y volvería a montar:
   * su limpieza devuelve el foco al elemento anterior y el usuario perdía el
   * cursor tras cada tecla. Guardarla en una ref deja el efecto atado solo a
   * `abierta`, que es lo único que debe montarlo y desmontarlo.
   */
  const alCerrarRef = useRef(alCerrar)
  useEffect(() => {
    alCerrarRef.current = alCerrar
  })

  useEffect(() => {
    if (!abierta) return

    previo.current = document.activeElement as HTMLElement | null
    const anchoBarra = window.innerWidth - document.documentElement.clientWidth
    const overflowPrevio = document.body.style.overflow
    const paddingPrevio = document.body.style.paddingRight

    // Compensar la barra de scroll evita el salto horizontal del layout al
    // abrir el diálogo, que en escritorio se nota mucho.
    document.body.style.overflow = 'hidden'
    if (anchoBarra > 0) document.body.style.paddingRight = `${anchoBarra}px`

    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        alCerrarRef.current()
        return
      }
      if (e.key !== 'Tab' || !contenedor.current) return

      // Trampa de foco: el tabulador no debe escaparse al fondo de la página.
      const focusables = contenedor.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const primero = focusables[0]
      const ultimo = focusables[focusables.length - 1]

      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alPulsar)
    const t = window.setTimeout(() => {
      contenedor.current
        ?.querySelector<HTMLElement>('input, button, [href], select, textarea')
        ?.focus()
    }, 60)

    return () => {
      document.removeEventListener('keydown', alPulsar)
      window.clearTimeout(t)
      document.body.style.overflow = overflowPrevio
      document.body.style.paddingRight = paddingPrevio
      previo.current?.focus?.()
    }
    // Solo `abierta`: ver la nota sobre alCerrarRef más arriba.
  }, [abierta])

  if (!abierta) return null

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) alCerrar()
      }}
    >
      <div
        ref={contenedor}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div className="sheet__grab" />
        <div className="sheet__header">
          <div className="sheet__titles">
            <h2 className="sheet__title">{titulo}</h2>
            {subtitulo && <p className="sheet__subtitle">{subtitulo}</p>}
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={alCerrar}
            aria-label="Cerrar"
          >
            <X size={19} />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        {pie && <div className="sheet__footer">{pie}</div>}
      </div>
    </div>
  )
}

/* ------------------------------ Skeletons ---------------------------------- */

export function SkeletonLinea({ ancho = '100%', alto = 14 }: { ancho?: string; alto?: number }) {
  return <div className="skeleton" style={{ width: ancho, height: alto }} />
}

/** Marcador de tarjeta con la MISMA altura que la real: el layout no salta. */
export function SkeletonTarjeta() {
  return (
    <div className="card" aria-hidden="true">
      <div className="card__body">
        <SkeletonLinea ancho="45%" alto={12} />
        <SkeletonLinea ancho="85%" alto={22} />
        <SkeletonLinea ancho="70%" />
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <SkeletonLinea ancho="72px" alto={20} />
          <SkeletonLinea ancho="90px" alto={20} />
        </div>
      </div>
      <div className="card__footer">
        <SkeletonLinea ancho="40%" alto={16} />
      </div>
    </div>
  )
}
