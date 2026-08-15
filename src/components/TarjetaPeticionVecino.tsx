import { CheckCircle2, MessageCircle, Phone } from 'lucide-react'
import { Badge } from './ui'
import { SelloFuente } from './Fuente'
import { ComoLlegar } from './ComoLlegar'
import type { PeticionPersona } from '@/dominio/modelos'
import { desde } from '@/lib/format'
import { formatearDistancia } from '@/lib/geo'

/**
 * Una petición del tablón de la comunidad.
 *
 * Va en la misma rejilla que las de Corag porque para quien va a ayudar son lo
 * mismo: una persona concreta que necesita algo. Lo que cambia es de quién te
 * fías y a quién reclamas, y para eso está el sello.
 *
 * Dos diferencias con Corag que se ven en la tarjeta:
 * - Aquí el teléfono viene siempre, sin casilla de consentimiento: el tablón
 *   nació publicándolo. No lo desbloqueamos nosotros.
 * - En vez de cobertura hay confirmaciones de la comunidad: alguien pasó por
 *   allí y dijo que la petición sigue en pie. Es otra forma de fiarse.
 */

const CATEGORIAS: Record<string, string> = {
  alimentos: 'Alimentos',
  medicinas: 'Medicamentos',
  herramientas: 'Herramientas',
  herramientas_rescate: 'Herramientas de rescate',
  transporte_logistica: 'Transporte',
  revision_ingenieria: 'Revisión de ingeniería',
  voluntariado: 'Voluntariado',
  mascotas: 'Mascotas',
  otros: 'Otros',
}

const ESTADOS: Record<string, { texto: string; tono: 'success' | 'warning' | 'neutral' }> = {
  buscando: { texto: 'Buscando ayuda', tono: 'warning' },
  en_camino: { texto: 'Ayuda en camino', tono: 'success' },
}

function whatsapp(telefono: string | null, titulo: string): string | null {
  if (!telefono) return null
  const d = telefono.replace(/\D/g, '')
  if (d.length < 10) return null
  const con57 = d.startsWith('57') ? d : `57${d}`
  return `https://wa.me/${con57}?text=${encodeURIComponent(
    `Hola, vi tu publicación "${titulo}" en AquíAyuda y quiero ayudar.`,
  )}`
}

export function TarjetaPeticionVecino({
  p,
  distanciaKm,
}: {
  p: PeticionPersona
  distanciaKm: number | null
}) {
  const wa = whatsapp(p.telefono, p.titulo)
  const estado = ESTADOS[p.estado] ?? { texto: p.estado, tono: 'neutral' as const }
  const foto = p.fotos[0]

  return (
    <article className="card" data-tipo="peticion">
      <span className="card__accent" data-origen="pereira-unida" aria-hidden="true" />
      {foto && (
        <img
          className="card__foto"
          src={foto}
          alt=""
          loading="lazy"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      <div className="card__body">
        <div className="row row--wrap">
          {p.urgente && <Badge tono="critical">Urgente</Badge>}
          <Badge tono={estado.tono}>{estado.texto}</Badge>
          <Badge tono="neutral">{CATEGORIAS[p.categoria] ?? p.categoria}</Badge>
          {distanciaKm != null && (
            <span
              className="num"
              style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}
            >
              {formatearDistancia(distanciaKm)}
            </span>
          )}
        </div>

        <h3 className="card__title clamp-3">{p.titulo}</h3>

        {p.descripcion && (
          <p className="clamp-3" style={{ color: 'var(--text-muted)', margin: 0 }}>
            {p.descripcion}
          </p>
        )}

        <div style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
          {[p.lugar, p.municipio].filter(Boolean).join(' · ')}
        </div>

        {/* La confirmación de la comunidad es lo que aquí sustituye a la
            cobertura de Corag: dice que alguien comprobó que sigue en pie. */}
        {p.confirmadaEn && (
          <div
            className="row"
            style={{ color: 'var(--success-solid)', fontSize: 'var(--text-sm)' }}
          >
            <CheckCircle2 size={15} strokeWidth={2.3} />
            <span>Confirmada {desde(p.confirmadaEn)}</span>
          </div>
        )}
      </div>

      <div className="card__footer">
        <SelloFuente origen="pereira-unida" />
        <ComoLlegar
          destino={{ lat: p.lat, lng: p.lng, direccion: p.lugar, zona: p.municipio, nombre: p.titulo }}
          variante="enlace"
        />
        <div className="spacer" />
        {wa ? (
          <a className="btn btn--sm btn--primary" href={wa} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={15} />
            <span>Escribir</span>
          </a>
        ) : p.telefono ? (
          <a className="btn btn--sm" href={`tel:${p.telefono.replace(/\D/g, '')}`}>
            <Phone size={15} />
            <span>Llamar</span>
          </a>
        ) : (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)' }}>
            Sin contacto
          </span>
        )}
      </div>
    </article>
  )
}
