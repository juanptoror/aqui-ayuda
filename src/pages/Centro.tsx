import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Boxes,
  Building2,
  CircleCheck,
  CircleSlash,
  DoorOpen,
  FileText,
  MapPin,
  Navigation,
  Package,
  Phone,
  User,
  UserPlus,
} from 'lucide-react'
import {
  PageHeader,
  EmptyState,
  Badge,
  SkeletonLinea,
  Notice,
  AvisoError,
} from '@/components/ui'
import { AvisoTelefonos, Acceso } from '@/components/Acceso'
import { SelloFuente } from '@/components/Fuente'
import { OfrecerDonacion } from '@/components/formularios/OfrecerDonacion'
import { useUnirseACentro } from '@/datos/consultas'
import type { Necesidad } from '@/dominio/modelos'
import { usePreferencias } from '@/state/preferencias'
import { useCentros } from '@/datos/consultas'
import { useSesion } from '@/state/sesion'
import { useDatosCiudad } from '@/datos/useDatosCiudad'
import { useMunicipios } from '@/datos/consultas'
import { formatearDistancia } from '@/lib/geo'
import { conteo, desde, enlaceMapa, enlaceTelefono, numero } from '@/lib/format'

export function Centro() {
  const { id } = useParams<{ id: string }>()
  const { ubicacion } = usePreferencias()
  const { sesion } = useSesion()

  const unirse = useUnirseACentro()
  const [ofreciendo, setOfreciendo] = useState<Necesidad | null>(null)
  const [accesoAbierto, setAccesoAbierto] = useState(false)

  /** Unirse exige sesión: si no la hay, se abre el acceso en vez de fallar. */
  function pedirUnirse() {
    if (!id) return
    if (!sesion) {
      setAccesoAbierto(true)
      return
    }
    unirse.mutate(id)
  }

  // El centro se localiza primero en la lista global para deducir su municipio;
  // así el enlace directo a /centro/:id funciona aunque el usuario nunca haya
  // pasado por la página de la ciudad.
  const qCentros = useCentros(!!sesion)
  const qCiudades = useMunicipios()
  const centroSuelto = (qCentros.data ?? []).find((c) => c.id === id) ?? null
  const slug =
    (qCiudades.data ?? []).find((c) => c.id === centroSuelto?.ciudadId)?.slug ?? undefined

  const datos = useDatosCiudad(slug, ubicacion)
  const centro = datos.centros.find((c) => c.id === id) ?? null

  if (qCentros.isLoading || (centroSuelto && datos.cargando)) {
    return (
      <>
        <PageHeader titulo="Cargando centro…" />
        <div className="container">
          <div className="panel">
            <div className="panel__body stack">
              <SkeletonLinea ancho="50%" alto={22} />
              <SkeletonLinea ancho="80%" />
              <SkeletonLinea ancho="65%" />
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!centro) {
    return (
      <>
        <PageHeader
          titulo="No encontramos ese centro"
          subtitulo="Puede que lo hayan retirado del listado o que el enlace esté incompleto."
        />
        <div className="container">
          <EmptyState
            icono={Building2}
            titulo="Centro no disponible"
            texto="Vuelve al listado de tu municipio para ver los centros que siguen activos."
            acciones={
              <Link className="btn btn--primary" to={slug ? `/ciudad/${slug}` : '/ciudades'}>
                <span>Ver centros del municipio</span>
              </Link>
            }
          />
        </div>
      </>
    )
  }

  const mapa = enlaceMapa(centro.lat, centro.lng, centro.direccion)
  const tel = enlaceTelefono(centro.telefono ?? null)
  const pendientes = centro.necesidades.filter((n) => n.estado === 'pendiente')
  const cubiertas = centro.necesidades.filter((n) => n.estado === 'cubierta')
  const disponible = centro.inventario.filter((i) => i.cantidad > 0)

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <MapPin size={13} strokeWidth={2.6} />
            {datos.ciudad?.nombre ?? 'Centro de acopio'}
            {centro.distanciaKm != null && ` · a ${formatearDistancia(centro.distanciaKm)}`}
          </>
        }
        titulo={centro.nombre}
        subtitulo={
          centro.abierto
            ? pendientes.length > 0
              ? `Abierto ahora · ${conteo(pendientes.length, 'pedido', 'pedidos')}, ${numero(centro.urgentes)} urgentes.`
              : 'Abierto ahora · sin pedidos pendientes.'
            : 'Cerrado ahora mismo. Confirma antes de desplazarte.'
        }
        acciones={
          <>
            <Link className="btn" to={slug ? `/ciudad/${slug}` : '/ciudades'}>
              <ArrowLeft size={18} />
              <span>Volver</span>
            </Link>
            <button type="button" className="btn" onClick={pedirUnirse} disabled={unirse.isPending}>
              <UserPlus size={18} />
              <span>{unirse.isPending ? 'Enviando…' : 'Unirme al equipo'}</span>
            </button>
            {mapa && (
              <a className="btn btn--primary" href={mapa} target="_blank" rel="noopener noreferrer">
                <Navigation size={18} />
                <span>Cómo llegar</span>
              </a>
            )}
          </>
        }
      />

      <div className="container">
        <div className="stack">
          {unirse.isSuccess && (
            <Notice tono="info" icono={CircleCheck}>
              <strong>Solicitud enviada.</strong> Quien coordina este centro la verá y te
              contactará. Si la mandas otra vez no se duplica.
            </Notice>
          )}
          {unirse.error ? <AvisoError error={unirse.error} origen="AP" /> : null}
          <AvisoTelefonos />
        </div>

        <div className="grid grid--halves grid--top" style={{ marginTop: 'var(--sp-6)' }}>
          <section className="panel">
            <div className="panel__header">
              {centro.abierto ? (
                <DoorOpen size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
              ) : (
                <CircleSlash size={18} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
              )}
              <h2 className="panel__title">Cómo llegar y contactar</h2>
              <div className="spacer" />
              <SelloFuente origen="ayudas-pereira" />
              {centro.abierto ? (
                <Badge tono="success">Abierto</Badge>
              ) : (
                <Badge tono="neutral">Cerrado</Badge>
              )}
            </div>
            <div className="panel__body">
              <div className="deflist">
                <div className="deflist__row">
                  <MapPin size={16} className="deflist__icon" />
                  <div className="deflist__content">
                    <div className="deflist__label">Dirección</div>
                    <div className="deflist__value">{centro.direccion ?? 'No registrada'}</div>
                  </div>
                </div>
                <div className="deflist__row">
                  <User size={16} className="deflist__icon" />
                  <div className="deflist__content">
                    <div className="deflist__label">Responsable</div>
                    <div className="deflist__value">{centro.responsable ?? 'No registrado'}</div>
                  </div>
                </div>
                <div className="deflist__row">
                  <Phone size={16} className="deflist__icon" />
                  <div className="deflist__content">
                    <div className="deflist__label">Teléfono</div>
                    <div className="deflist__value">
                      {tel ? (
                        <a href={tel}>{centro.telefono}</a>
                      ) : sesion ? (
                        'No registrado'
                      ) : (
                        <span style={{ color: 'var(--text-subtle)' }}>
                          Visible al entrar con tu correo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {centro.notas && (
                  <div className="deflist__row">
                    <FileText size={16} className="deflist__icon" />
                    <div className="deflist__content">
                      <div className="deflist__label">Detalles del centro</div>
                      <div className="deflist__value">{centro.notas}</div>
                    </div>
                  </div>
                )}
              </div>

              {centro.foto && (
                <img
                  src={centro.foto}
                  alt={`Fachada de ${centro.nombre}`}
                  loading="lazy"
                  style={{
                    marginTop: 'var(--sp-5)',
                    width: '100%',
                    aspectRatio: '16 / 10',
                    objectFit: 'cover',
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--border)',
                  }}
                />
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <Boxes size={18} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
              <h2 className="panel__title">Qué tiene disponible</h2>
              <div className="spacer" />
              <span className="section__count">{disponible.length}</span>
            </div>
            <div className="panel__body">
              {disponible.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Este centro no ha reportado existencias disponibles.
                </p>
              ) : (
                <ul
                  style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--sp-3)' }}
                >
                  {disponible.map((i) => (
                    <li key={i.id} className="row">
                      <span className="min0 truncate" style={{ flex: '1 1 auto' }}>
                        {i.categoria}
                      </span>
                      <span className="num" style={{ fontWeight: 700, flexShrink: 0 }}>
                        {numero(i.cantidad)} {i.unidad}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <section className="section">
          <div className="panel">
            <div className="panel__header">
              <Package size={18} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
              <h2 className="panel__title">Qué están pidiendo</h2>
              <div className="spacer" />
              <span className="section__count">{pendientes.length}</span>
            </div>
            <div className="panel__body">
              {pendientes.length === 0 ? (
                <EmptyState
                  icono={Package}
                  titulo="Sin pedidos abiertos"
                  texto="Este centro tiene cubierto lo que necesitaba. Revisa otros centros del municipio antes de llevar donaciones aquí."
                  acciones={
                    <Link className="btn btn--primary" to={slug ? `/ciudad/${slug}` : '/ciudades'}>
                      <span>Ver otros centros</span>
                    </Link>
                  }
                />
              ) : (
                <ul
                  style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--sp-4)' }}
                >
                  {pendientes
                    .slice()
                    .sort((a, b) => peso(b.prioridad) - peso(a.prioridad))
                    .map((n) => (
                      <li key={n.id} className="row" style={{ alignItems: 'flex-start' }}>
                        <span style={{ flexShrink: 0, marginTop: 2 }}>
                          {n.prioridad === 'urgente' ? (
                            <Badge tono="critical">Urgente</Badge>
                          ) : n.prioridad === 'alta' ? (
                            <Badge tono="warning">Alta</Badge>
                          ) : (
                            <Badge tono="neutral">Normal</Badge>
                          )}
                        </span>
                        <div className="min0" style={{ flex: '1 1 auto' }}>
                          <div style={{ fontWeight: 650 }}>{n.categoria}</div>
                          {n.descripcion && (
                            <div style={{ color: 'var(--text-muted)', overflowWrap: 'break-word' }}>
                              {n.descripcion}
                            </div>
                          )}
                          <div style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
                            Reportado {desde(n.creadaEn)}
                          </div>
                        </div>
                        {/* Ofrecer contra ESTA necesidad: el ofrecimiento queda
                            ligado a ella, así el centro sabe qué cubre. */}
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          style={{ flexShrink: 0 }}
                          onClick={() => setOfreciendo(n)}
                        >
                          <span>Yo tengo</span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}

              {cubiertas.length > 0 && (
                <>
                  <hr className="hr" />
                  <div className="deflist__label" style={{ marginBottom: 'var(--sp-3)' }}>
                    Ya cubierto ({cubiertas.length})
                  </div>
                  <div className="chips">
                    {[...new Set(cubiertas.map((c) => c.categoria))].map((c) => (
                      <span key={c} className="badge badge--success" style={{ textTransform: 'none' }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      {datos.ciudad && (
        <OfrecerDonacion
          abierto={ofreciendo !== null}
          alCerrar={() => setOfreciendo(null)}
          ciudadId={datos.ciudad.id}
          ciudadNombre={datos.ciudad.nombre}
          necesidad={ofreciendo}
          centroId={centro.id}
          centroNombre={centro.nombre}
        />
      )}
      <Acceso abierto={accesoAbierto} alCerrar={() => setAccesoAbierto(false)} />
    </>
  )
}

/* Los diálogos van fuera del flujo del documento: se montan al final. */
function peso(p: string): number {
  return p === 'urgente' ? 3 : p === 'alta' ? 2 : 1
}
