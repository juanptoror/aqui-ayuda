import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CircleCheck,
  ExternalLink,
  HandHeart,
  MapPin,
  Megaphone,
  MessageCircle,
  PackageSearch,
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
import { Fab } from '@/components/Fab'
import { SelloFuente, FuentesDeLaPantalla } from '@/components/Fuente'
import { TarjetaPeticionVecino } from '@/components/TarjetaPeticionVecino'
import { FichaAyuda } from '@/components/FichaAyuda'
import { usePeticionesPersona } from '@/datos/consultas'
import { distanciaKm as distancia } from '@/lib/geo'
import { usePreferencias } from '@/state/preferencias'
import { useAyudas, useEmergencias, enlaceWhatsapp, type AyudaCorag, type TipoAyuda } from '@/backends/corag'
import { ComoLlegar } from '@/components/ComoLlegar'
import { useCrucesConCentros, type CruceAyuda } from '@/datos/useCruces'
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
  const [ficha, setFicha] = useState<AyudaCorag | null>(null)
  const [verTodas, setVerTodas] = useState(false)

  const qEmergencias = useEmergencias()
  const q = useAyudas({ tipo, ubicacion, radioKm, limite: 60 })
  /* La otra mitad de las peticiones. Corag y Pereira Unida publican lo mismo
     —una persona concreta que necesita algo— y hasta ahora solo se veía una:
     había 282 peticiones del tablón que esta pantalla no enseñaba. No hay
     riesgo de duplicado porque son comunidades distintas, y cada tarjeta lleva
     su sello para saber a quién reclamar si el dato está mal. */
  const qVecinos = usePeticionesPersona()

  const items = q.data?.items ?? []
  const emergencia = qEmergencias.data?.[0]

  // Cruce con el inventario de los centros: la razón de tener las dos fuentes.
  /* Solo al mirar peticiones: los ofrecimientos del tablón viven en "Quién
     puede ayudar", que es donde se busca a alguien y no algo. */
  const vecinos =
    tipo === 'request'
      ? (qVecinos.data ?? [])
          .map((v) => ({
            v,
            km:
              ubicacion && v.lat != null && v.lng != null
                ? distancia(ubicacion, { lat: v.lat, lng: v.lng })
                : null,
          }))
          .filter((x) => x.km == null || x.km <= radioKm)
          .sort((a, b) => {
            if (a.v.urgente !== b.v.urgente) return a.v.urgente ? -1 : 1
            if (a.km != null && b.km != null) return a.km - b.km
            return b.v.creadaEn.localeCompare(a.v.creadaEn)
          })
      : []

  /* Juntas son 255 publicaciones. Volcarlas de una vez repite el error que ya
     cometimos en "Quién puede ayudar": nadie las lee y la página se hace
     interminable en el móvil. Van ordenadas por urgencia y cercanía, así que
     las primeras son las que importan. */
  const TOPE_VECINOS = 20
  const vecinosVisibles = verTodas ? vecinos : vecinos.slice(0, TOPE_VECINOS)

  const cruces = useCrucesConCentros(items)
  const conCruce = items.filter((a) => cruces.has(a.id)).length

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
        <FuentesDeLaPantalla
          origenes={['corag', 'pereira-unida']}
          nota="Dos tablones de la misma emergencia. En Corag el teléfono solo sale si la persona lo autorizó al publicar; en Pereira Unida es público en origen."
        />
        <div className="stack">
          <Notice tono="info" icono={MessageCircle}>
            Aquí publican <strong>personas</strong>, no centros de acopio: a un centro se le lleva
            una donación, a una persona se le escribe. Cada tarjeta dice de qué tablón sale.
          </Notice>
          {conCruce > 0 && (
            <Notice tono="info" icono={PackageSearch}>
              <strong>
                {conteo(conCruce, 'petición ya la puede cubrir', 'peticiones ya las pueden cubrir')}{' '}
                un centro cercano.
              </strong>{' '}
              Lo cruzamos con el inventario de Ayudas Pereira: si alguien pide agua y un centro a
              dos calles la tiene, aquí lo dice.
            </Notice>
          )}
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
                <TarjetaAyuda key={a.id} ayuda={a} cruce={cruces.get(a.id)} alAbrir={setFicha} />
              ))}
              {vecinosVisibles.map(({ v, km }) => (
                <TarjetaPeticionVecino key={v.id} p={v} distanciaKm={km} />
              ))}
            </div>
          )}

          {!verTodas && vecinos.length > TOPE_VECINOS && (
            <div className="row" style={{ marginTop: 'var(--sp-5)' }}>
              <button type="button" className="btn" onClick={() => setVerTodas(true)}>
                <span>
                  Ver las {vecinos.length - TOPE_VECINOS} peticiones restantes del tablón
                </span>
              </button>
            </div>
          )}
        </section>
      </div>

      <FichaAyuda ayuda={ficha} alCerrar={() => setFicha(null)} />

      <Fab etiqueta="Publicar" icono={Megaphone} alPulsar={() => setPublicando(true)} />

      <PublicarAyuda
        abierto={publicando}
        alCerrar={() => setPublicando(false)}
        alPublicar={() => q.refetch()}
      />
    </>
  )
}

/** Une barrio y dirección sin repetir el mismo nombre dos veces. */
function lugarDe(ayuda: AyudaCorag): string {
  const partes = [ayuda.location?.neighborhood, ayuda.location?.address]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p)

  const vistas = new Set<string>()
  const unicas = partes.filter((p) => {
    const clave = p.toLowerCase()
    if (vistas.has(clave)) return false
    vistas.add(clave)
    return true
  })

  return unicas.join(' · ')
}

function TarjetaAyuda({
  ayuda,
  cruce,
  alAbrir,
}: {
  ayuda: AyudaCorag
  cruce?: CruceAyuda
  alAbrir: (a: AyudaCorag) => void
}) {
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
              {/* Barrio y dirección llegan repetidos con frecuencia ("Cuba ·
                  Cuba"): se comparan sin distinguir mayúsculas ni espacios
                  sobrantes antes de unirlos. */}
              <div className="deflist__value clamp-2">{lugarDe(ayuda)}</div>
              {/* Corag publica coordenada exacta en casi todas: es la diferencia
                  entre "está en Guadalupe" y poder salir hacia allá. */}
              <ComoLlegar
                destino={{
                  lat: ayuda.location?.latitude,
                  lng: ayuda.location?.longitude,
                  direccion: ayuda.location?.address,
                  zona: ayuda.location?.neighborhood,
                  nombre: ayuda.title,
                }}
                variante="enlace"
              />
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

        {/* EL CRUCE ENTRE LOS DOS BACKENDS.
            Esta persona pide algo en Corag y un centro de Ayudas Pereira lo
            tiene. Son dos bases de datos que no se hablan; esto las conecta. */}
        {cruce && cruce.centros.length > 0 && (
          <div className="cruce">
            <div className="cruce__titulo">
              <PackageSearch size={13} strokeWidth={2.6} />
              {cruce.hayExacto ? 'Esto lo tienen cerca' : 'Hay algo parecido cerca'}
            </div>
            <ul className="cruce__lista">
              {cruce.centros.map((c) => (
                <li key={c.centroId + c.unidad}>
                  <Link to={`/centro/${encodeURIComponent(c.centroId)}`}>{c.centroNombre}</Link>
                  <span className="num" style={{ color: 'var(--text-muted)' }}>
                    {' '}
                    · {numero(c.cantidad)} {c.unidad}
                  </span>
                  {c.distanciaKm != null && (
                    <span className="num" style={{ color: 'var(--text-subtle)' }}>
                      {' '}
                      · a {formatearDistancia(c.distanciaKm)}
                    </span>
                  )}
                  {!c.abierto && (
                    <span style={{ color: 'var(--text-subtle)' }}> · cerrado</span>
                  )}
                  {c.precision === 'aproximada' && (
                    <span style={{ color: 'var(--text-subtle)' }}> · parecido</span>
                  )}
                </li>
              ))}
            </ul>
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
        {/* La tarjeta resume; la ficha trae el desglose por recurso, las
            confirmaciones de la comunidad y qué ha pasado con esta ayuda.
            Todo eso ya venía cargado en la lista y no se estaba mirando. */}
        <button type="button" className="btn btn--sm" onClick={() => alAbrir(ayuda)}>
          <span>Ver detalle</span>
        </button>
        <SelloFuente origen="corag" />
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
