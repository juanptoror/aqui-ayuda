import { BedDouble, Construction, Database, Network, Users } from 'lucide-react'

/**
 * Sello de procedencia del dato.
 *
 * La app junta tres backends independientes y eso el usuario tiene derecho a
 * saberlo: si un teléfono no responde o una dirección está mal, hay que poder
 * decir a QUIÉN reclamar. Además, cada fuente tiene reglas distintas —los
 * centros los publica un equipo local, las peticiones de Corag las publica
 * cualquiera— y esa diferencia cambia cuánto te puedes fiar de lo que lees.
 */

export type Origen =
  | 'ayudas-pereira'
  | 'corag'
  | 'pereira-unida'
  | 'vivienda'
  | 'pereira-responde'

interface InfoFuente {
  nombre: string
  /** Qué es, en palabras de cualquiera. El nombre del proveedor técnico no
      aparece aquí: a quien busca dónde llevar una caja no le dice nada. */
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
  vivienda: {
    nombre: 'Encuéntralo a un Clic',
    tipo: 'Vivienda en arriendo',
    descripcion: 'Inmuebles en arriendo con fotos, sobre todo en el Quindio.',
    quienPublica: 'Propietarios e inmobiliarias.',
    url: 'https://encuentraloaunclic.com',
    icono: BedDouble,
  },
  'pereira-responde': {
    nombre: 'Pereira Responde',
    tipo: 'Daños y vías cerradas',
    descripcion: 'Qué edificio está tocado y por qué calle no se pasa, con foto y coordenada.',
    quienPublica: 'Cualquier persona desde el mapa de Pereira Responde.',
    url: 'https://pereiraresponde.co',
    icono: Construction,
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

/**
 * De dónde salen los datos de ESTA pantalla.
 *
 * Va una vez por pantalla, arriba, y no sustituye al sello de cada tarjeta:
 * responde a otra pregunta. El sello dice "este dato concreto es de X"; esto
 * dice "aquí estás viendo X e Y mezclados, y por eso hay cosas que en una
 * aparecen y en la otra no".
 *
 * En una emergencia esa diferencia importa: si un teléfono no responde o una
 * dirección está mal, hay que saber a quién reclamar, y si una lista parece
 * corta hay que saber si es que falta oferta o que falta una fuente.
 */
export function FuentesDeLaPantalla({
  origenes,
  nota,
}: {
  origenes: Origen[]
  nota?: string
}) {
  const unicos = [...new Set(origenes)]
  if (unicos.length === 0) return null

  return (
    <div className="fuentes-pantalla">
      <span className="fuentes-pantalla__label">
        {unicos.length === 1 ? 'Datos de' : 'Datos de'}
      </span>
      <div className="fuentes-pantalla__sellos">
        {unicos.map((o) => {
          const f = FUENTES[o]
          return f.url ? (
            <a
              key={o}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${f.nombre}: ${f.descripcion} Publica: ${f.quienPublica}`}
            >
              <SelloFuente origen={o} />
            </a>
          ) : (
            <span key={o} title={`${f.nombre}: ${f.descripcion} Publica: ${f.quienPublica}`}>
              <SelloFuente origen={o} />
            </span>
          )
        })}
      </div>
      {nota && <p className="fuentes-pantalla__nota">{nota}</p>}
    </div>
  )
}
