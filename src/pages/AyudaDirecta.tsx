import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CircleCheck,
  ExternalLink,
  HandHeart,
  MapPin,
  MessageCircle,
  Plus,
  TriangleAlert,
  Users,
} from 'lucide-react'
import {
  PageHeader,
  Notice,
  SectionHead,
  EmptyState,
  Badge,
  SkeletonTarjeta,
} from '@/components/ui'
import { PublicarAyuda } from '@/components/PublicarAyuda'
import { usePreferencias } from '@/state/preferencias'
import { useAyudas, useEmergencias, enlaceWhatsapp, type AyudaCorag, type TipoAyuda } from '@/data/corag'
import { formatearDistancia } from '@/lib/geo'
import { conteo, desde, numero } from '@/lib/format'

const RADIOS = [25, 50, 150]

/**
 * Ayuda directa entre personas, servida por la API pública de Corag.
 *
 * Es la otra mitad de la app: Supabase tiene los centros de acopio
 * (organizaciones) y esto tiene a las familias concretas que piden algo. Se
 * mantienen en pantallas separadas a propósito, porque la acción es distinta:
 * a un centro se le lleva una donación, a una persona se le escribe.
 */
export function AyudaDirecta() {
  const { ubicacion } = usePreferencias()
  const [tipo, setTipo] = useState<TipoAyuda>('request')
  const [radioKm, setRadioKm] = useState(50)
  const [publicando, setPublicando] = useState(false)

  const qEmergencias = useEmergencias()
  const q = useAyudas({ tipo, ubicacion, radioKm, limite: 60 })

  const items = q.data?.items ?? []
  const emergencia = qEmergencias.data?.[0]

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <HandHeart size={13} strokeWidth={2.6} />
            {emergencia?.title ?? 'Ayuda directa'}
          </>
        }
        titulo="Ayuda directa entre personas"
        subtitulo={
          q.isLoading
            ? 'Consultando publicaciones abiertas…'
            : q.error
              ? 'Ahora mismo no podemos consultar las publicaciones. Los centros de acopio siguen disponibles.'
              : `${conteo(q.data?.total ?? 0, 'publicación abierta', 'publicaciones abiertas')}${
                  ubicacion ? ` · mostrando las de menos de ${radioKm} km` : ''
                }. Cada una la publicó una persona y se contacta por WhatsApp.`
        }
        acciones={
          <button type="button" className="btn btn--primary" onClick={() => setPublicando(true)}>
            <Plus size={18} />
            <span>Publicar</span>
          </button>
        }
      />

      <div className="container">
        <div className="stack">
          <Notice tono="info" icono={MessageCircle}>
            Estas publicaciones vienen de <strong>Corag</strong>, no de los centros de acopio. Los
            teléfonos se muestran porque cada persona autorizó publicarlos.
          </Notice>
          {q.error && (
            <Notice tono="critical">
              No pudimos cargar la ayuda directa: {(q.error as Error).message}
            </Notice>
          )}
        </div>

        <section className="section" aria-label="Qué quieres ver">
          <div className="segmented" role="tablist" style={{ maxWidth: 620 }}>
            <button
              type="button"
              role="tab"
              aria-selected={tipo === 'request'}
              className="segmented__option"
              onClick={() => setTipo('request')}
            >
              <TriangleAlert size={19} strokeWidth={2.1} />
              <span>Quién necesita</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tipo === 'offer'}
              className="segmented__option"
              onClick={() => setTipo('offer')}
            >
              <HandHeart size={19} strokeWidth={2.1} />
              <span>Quién ofrece</span>
            </button>
          </div>
        </section>

        {ubicacion && (
          <section className="section">
            <SectionHead titulo="Distancia máxima" />
            <div className="chips">
              {RADIOS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="chip"
                  aria-pressed={radioKm === r}
                  onClick={() => setRadioKm(r)}
                >
                  <span>{r} km</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <SectionHead
            titulo={tipo === 'request' ? 'Personas que necesitan ayuda' : 'Personas que ofrecen ayuda'}
            conteo={
              q.isLoading || q.error
                ? undefined
                : conteo(items.length, 'publicación', 'publicaciones')
            }
          />

          {q.isLoading ? (
            <div className="grid grid--cards">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonTarjeta key={i} />
              ))}
            </div>
          ) : q.error ? (
            /* Un fallo de la fuente externa NO puede presentarse como "no hay
               nada": decir "nadie ha pedido ayuda" cuando en realidad no se
               pudo preguntar es desinformar en plena emergencia. */
            <EmptyState
              tono="critical"
              icono={TriangleAlert}
              titulo="La fuente de ayuda directa no está respondiendo"
              texto={
                <>
                  El servicio de Corag devolvió un error, así que ahora mismo no podemos saber
                  qué hay publicado. <strong>No significa que no haya nadie pidiendo ayuda.</strong>{' '}
                  Los centros de acopio siguen disponibles en el resto de la app.
                </>
              }
              acciones={
                <>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => q.refetch()}
                    disabled={q.isFetching}
                  >
                    <span>{q.isFetching ? 'Reintentando…' : 'Reintentar'}</span>
                  </button>
                  <Link className="btn" to="/ciudades">
                    <span>Ver centros de acopio</span>
                  </Link>
                </>
              }
            />
          ) : items.length === 0 ? (
            <EmptyState
              icono={tipo === 'request' ? CircleCheck : HandHeart}
              titulo={
                tipo === 'request'
                  ? 'Nadie ha pedido ayuda en este radio'
                  : 'Todavía nadie ha ofrecido ayuda aquí'
              }
              texto={
                ubicacion
                  ? `No hay publicaciones a menos de ${radioKm} km. Prueba a ampliar la distancia.`
                  : 'Comparte tu ubicación desde el inicio para ver lo que hay cerca de ti.'
              }
              acciones={
                ubicacion && radioKm !== 150 ? (
                  <button type="button" className="btn btn--primary" onClick={() => setRadioKm(150)}>
                    <span>Ampliar a 150 km</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => setPublicando(true)}
                  >
                    <span>Publicar una ayuda</span>
                  </button>
                )
              }
            />
          ) : (
            <div className="grid grid--cards">
              {items.map((a) => (
                <TarjetaAyuda key={a.id} ayuda={a} />
              ))}
            </div>
          )}
        </section>
      </div>

      <PublicarAyuda
        abierto={publicando}
        alCerrar={() => setPublicando(false)}
        alPublicar={() => q.refetch()}
      />
    </>
  )
}

function TarjetaAyuda({ ayuda }: { ayuda: AyudaCorag }) {
  const wa = enlaceWhatsapp(ayuda.contact?.whatsapp ?? null, ayuda.title)
  const cobertura = ayuda.quantities?.coveragePercentage ?? null
  const urgente = ayuda.urgency === 'urgent'

  return (
    <article className="card">
      <span
        className="card__accent"
        style={{
          ['--accent-color' as string]: urgente ? 'var(--critical)' : 'var(--brand)',
        }}
      />
      <div className="card__body">
        <div className="row" style={{ gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {urgente ? (
            <Badge tono="critical">Urgente</Badge>
          ) : (
            <Badge tono="warning">Necesario</Badge>
          )}
          <Badge tono="neutral">{ayuda.category}</Badge>
          <div className="spacer" />
          {ayuda.location?.distanceKm != null && (
            <span
              className="num"
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {formatearDistancia(ayuda.location.distanceKm)}
            </span>
          )}
        </div>

        <h3 className="card__title">{ayuda.title}</h3>

        {ayuda.description && (
          <p className="clamp-3" style={{ color: 'var(--text-muted)', margin: 0 }}>
            {ayuda.description}
          </p>
        )}

        {(ayuda.location?.address || ayuda.location?.neighborhood) && (
          <div className="deflist__row">
            <MapPin size={15} className="deflist__icon" />
            <div className="deflist__content">
              <div className="deflist__value clamp-2">
                {[ayuda.location.neighborhood, ayuda.location.address]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>
        )}

        {cobertura != null && ayuda.quantities && ayuda.quantities.required > 0 && (
          <div>
            <div
              className="row"
              style={{ justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}
            >
              <span className="deflist__label">Cubierto</span>
              <span className="num" style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                {numero(Math.round(cobertura))}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 'var(--r-full)',
                background: 'var(--surface-3)',
                overflow: 'hidden',
              }}
              role="presentation"
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(3, cobertura))}%`,
                  borderRadius: 'var(--r-full)',
                  background: cobertura >= 100 ? 'var(--success-solid)' : 'var(--accion)',
                }}
              />
            </div>
          </div>
        )}

        <div className="row" style={{ gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          {ayuda.verification && ayuda.verification.confirmationCount > 0 && (
            <span
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-subtle)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Users size={13} />
              {conteo(ayuda.verification.confirmationCount, 'confirmación', 'confirmaciones')}
            </span>
          )}
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)' }}>
            {desde(ayuda.createdAt)}
          </span>
        </div>
      </div>

      <div className="card__footer">
        {wa ? (
          <a
            className="btn btn--sm btn--primary"
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={15} />
            <span>Escribir a {ayuda.contact?.name?.split(' ')[0] ?? 'quien publicó'}</span>
          </a>
        ) : (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)' }}>
            Sin contacto público
          </span>
        )}
        {ayuda.publicUrl && (
          <a
            className="btn btn--sm btn--ghost"
            href={ayuda.publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver la publicación original en Corag"
          >
            <ExternalLink size={15} />
          </a>
        )}
      </div>
    </article>
  )
}
