import { Database, Network, Users } from 'lucide-react'

/**
 * Sello de procedencia del dato.
 *
 * La app junta tres backends independientes y eso el usuario tiene derecho a
 * saberlo: si un teléfono no responde o una dirección está mal, hay que poder
 * decir a QUIÉN reclamar. Además, cada fuente tiene reglas distintas —los
 * centros los publica un equipo local, las peticiones de Corag las publica
 * cualquiera— y esa diferencia cambia cuánto te puedes fiar de lo que lees.
 */

export type Origen = 'ayudas-pereira' | 'corag' | 'pereira-unida'

interface InfoFuente {
  nombre: string
  /** Qué es, en palabras de cualquiera. El nombre del proveedor técnico no
      aparece aquí: eso vive en /estado, que es donde le sirve a alguien. */
  tipo: string
  descripcion: string
  quienPublica: string
  url: string | null
  icono: typeof Database
}

export const FUENTES: Record<Origen, InfoFuente> = {
  'ayudas-pereira': {
    nombre: 'Ayudas Pereira',
    tipo: 'Centros de acopio',
    descripcion: 'Dónde llevar o recoger donaciones, y qué necesita cada centro.',
    quienPublica: 'El equipo que coordina cada centro.',
    url: 'https://alluda.online',
    icono: Database,
  },
  corag: {
    nombre: 'Corag',
    tipo: 'Ayuda entre personas',
    descripcion: 'Personas concretas que piden u ofrecen algo, con su WhatsApp.',
    quienPublica: 'Cualquier persona, sin registrarse.',
    url: 'https://ayuda.corag.app',
    icono: Network,
  },
  'pereira-unida': {
    nombre: 'Pereira Unida',
    tipo: 'Tablon de la comunidad',
    descripcion: 'Vecinos que piden ayuda y vecinos que se ofrecen, con su telefono.',
    quienPublica: 'Cualquier persona, sin registrarse.',
    url: 'https://pereiraunida.com',
    icono: Users,
  },
}

/** Etiqueta compacta para poner dentro de una tarjeta. */
export function SelloFuente({ origen }: { origen: Origen }) {
  const f = FUENTES[origen]
  return (
    <span
      className="sello-fuente"
      data-origen={origen}
      title={`Dato de ${f.nombre} · ${f.tipo}`}
    >
      <f.icono size={11} strokeWidth={2.5} />
      {f.nombre}
    </span>
  )
}

/** Ficha completa, para la landing y la página "Acerca". */
export function TarjetaFuente({ origen, extra }: { origen: Origen; extra?: string }) {
  const f = FUENTES[origen]
  return (
    <article className="card">
      <span className="card__accent" data-origen={origen} />
      <div className="card__body">
        <div className="row" style={{ gap: 'var(--sp-3)' }}>
          <span className="kpi__icon" data-origen={origen}>
            <f.icono size={17} strokeWidth={2.25} />
          </span>
          <div className="min0">
            <h3 className="card__title" style={{ fontSize: '1.0625rem' }}>
              {f.nombre}
            </h3>
            <span className="deflist__label">{f.tipo}</span>
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', margin: 0 }}>{f.descripcion}</p>

        <div className="deflist">
          <div className="deflist__row">
            <div className="deflist__content">
              <div className="deflist__label">Quién publica</div>
              <div className="deflist__value">{f.quienPublica}</div>
            </div>
          </div>
          {extra && (
            <div className="deflist__row">
              <div className="deflist__content">
                <div className="deflist__label">En esta app</div>
                <div className="deflist__value">{extra}</div>
              </div>
            </div>
          )}
        </div>
      </div>
      {f.url && (
        <div className="card__footer">
          <a
            className="btn btn--sm btn--ghost"
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Ver la fuente original</span>
          </a>
        </div>
      )}
    </article>
  )
}
