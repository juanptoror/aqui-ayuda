import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Building2,
  ChevronRight,
  HeartHandshake,
  LocateFixed,
  MapPin,
  Navigation,
  Package,
  TriangleAlert,
} from 'lucide-react'
import { PageHeader, Notice, SectionHead, EmptyState, SkeletonLinea } from '@/components/ui'
import { SelectorCiudad } from '@/components/SelectorCiudad'
import { usePreferencias } from '@/state/preferencias'
import { useCiudadesCercanas } from '@/data/useDatos'
import { obtenerUbicacion, formatearDistancia, coordenadaDeCiudad } from '@/lib/geo'
import { conteo } from '@/lib/format'

export function Home() {
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const { ubicacion, fijarUbicacion, ciudadGuardada, fijarCiudadGuardada } = usePreferencias()
  const { ciudades, cargando, error } = useCiudadesCercanas(ubicacion)

  const [buscando, setBuscando] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null)
  const [selectorAbierto, setSelectorAbierto] = useState(false)

  // Compatibilidad con los enlaces ya compartidos del formato /?ciudad=slug.
  // Se conserva porque hay gente que ya tiene esa URL guardada o pegada en un
  // chat, y romperla en plena emergencia no es una opción.
  const ciudadEnQuery = params.get('ciudad')
  useEffect(() => {
    if (ciudadEnQuery) navegar(`/ciudad/${ciudadEnQuery}`, { replace: true })
  }, [ciudadEnQuery, navegar])

  async function usarMiUbicacion() {
    setBuscando(true)
    setErrorUbicacion(null)
    try {
      const coord = await obtenerUbicacion()
      fijarUbicacion(coord)
    } catch (e) {
      setErrorUbicacion((e as Error).message)
    } finally {
      setBuscando(false)
    }
  }

  const masCercanas = ciudades.slice(0, 6)
  const tieneDistancias = masCercanas.some((c) => c.distanciaKm != null)

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <MapPin size={13} strokeWidth={2.6} />
            Colombia · Centros de acopio
          </>
        }
        titulo="¿Dónde necesitas ayuda?"
        subtitulo="Encuentra el centro de acopio más cercano, mira qué están pidiendo y cómo llegar. No necesitas registrarte."
        acciones={
          <>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={usarMiUbicacion}
              disabled={buscando}
            >
              <LocateFixed size={19} />
              <span>{buscando ? 'Buscando…' : 'Usar mi ubicación'}</span>
            </button>
            <button
              type="button"
              className="btn btn--lg"
              onClick={() => setSelectorAbierto(true)}
            >
              <Building2 size={19} />
              <span>Elegir municipio</span>
            </button>
          </>
        }
      />

      <div className="container">
        <div className="stack">
          {errorUbicacion && (
            <Notice
              tono="warning"
              accion={
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => setSelectorAbierto(true)}
                >
                  <span>Elegir municipio</span>
                </button>
              }
            >
              {errorUbicacion}
            </Notice>
          )}

          {ubicacion && !errorUbicacion && (
            <Notice tono="info" icono={Navigation}>
              Tenemos tu ubicación. Los municipios y centros aparecen ordenados del más cercano al
              más lejano.
            </Notice>
          )}

          {ciudadGuardada && (
            <div className="panel panel--raised">
              <div className="panel__body row row--wrap">
                <div className="min0" style={{ flex: '1 1 16rem' }}>
                  <div className="deflist__label">Seguiste consultando</div>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem' }} className="truncate">
                    {ciudades.find((c) => c.slug === ciudadGuardada)?.nombre ?? ciudadGuardada}
                  </div>
                </div>
                <Link className="btn btn--primary" to={`/ciudad/${ciudadGuardada}`}>
                  <span>Volver a abrir</span>
                  <ChevronRight size={17} />
                </Link>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => fijarCiudadGuardada(null)}
                >
                  <span>Quitar</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Los dos caminos posibles, separados y explícitos desde el inicio.
            La app entera se reduce a esta decisión. */}
        <section className="section">
          <SectionHead titulo="¿Qué necesitas hacer?" />
          <div className="grid grid--halves">
            <Link
              to={ciudadGuardada ? `/ciudad/${ciudadGuardada}` : '/ciudades'}
              className="card card--interactive"
              style={{ textDecoration: 'none' }}
            >
              <div className="card__body">
                <span
                  className="empty__icon"
                  style={{
                    ['--empty-icon-bg' as string]: 'var(--critical-soft)',
                    ['--empty-icon-fg' as string]: 'var(--critical)',
                  }}
                >
                  <Package size={26} strokeWidth={2} />
                </span>
                <h3 className="card__title">Necesito ayuda</h3>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Mira qué centros están abiertos cerca de ti, qué tienen disponible y a qué
                  teléfono llamar.
                </p>
              </div>
              <div className="card__footer">
                <span style={{ fontWeight: 650, color: 'var(--accion)' }}>Ver centros abiertos</span>
                <div className="spacer" />
                <ChevronRight size={18} style={{ color: 'var(--accion)' }} />
              </div>
            </Link>

            <Link to="/como-ayudar" className="card card--interactive" style={{ textDecoration: 'none' }}>
              <div className="card__body">
                <span className="empty__icon">
                  <HeartHandshake size={26} strokeWidth={2} />
                </span>
                <h3 className="card__title">Quiero ayudar</h3>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Consulta qué hace falta de verdad en cada municipio antes de comprar o mover algo.
                </p>
              </div>
              <div className="card__footer">
                <span style={{ fontWeight: 650, color: 'var(--accion)' }}>Ver qué falta</span>
                <div className="spacer" />
                <ChevronRight size={18} style={{ color: 'var(--accion)' }} />
              </div>
            </Link>
          </div>
        </section>

        <section className="section">
          <SectionHead
            titulo={tieneDistancias ? 'Municipios más cercanos' : 'Municipios con centros activos'}
            conteo={cargando ? undefined : conteo(ciudades.length, 'municipio', 'municipios')}
            acciones={
              <Link to="/ciudades" className="btn btn--sm">
                <span>Ver todos</span>
                <ChevronRight size={15} />
              </Link>
            }
          />

          {error ? (
            <EmptyState
              tono="critical"
              icono={TriangleAlert}
              titulo="No pudimos cargar los municipios"
              texto="Revisa tu conexión e inténtalo otra vez. Si el problema sigue, el servidor de datos puede estar caído."
              acciones={
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => window.location.reload()}
                >
                  <span>Reintentar</span>
                </button>
              }
            />
          ) : cargando ? (
            <div className="grid grid--cards">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="panel" style={{ padding: 'var(--sp-5)' }}>
                  <SkeletonLinea ancho="60%" alto={20} />
                  <div style={{ height: 10 }} />
                  <SkeletonLinea ancho="40%" />
                </div>
              ))}
            </div>
          ) : masCercanas.length === 0 ? (
            <EmptyState
              icono={Building2}
              titulo="Todavía no hay municipios publicados"
              texto="Cuando un municipio registre su primer centro de acopio, aparecerá aquí."
              acciones={
                <Link className="btn btn--primary" to="/como-ayudar">
                  <span>Ver cómo ayudar</span>
                </Link>
              }
            />
          ) : (
            <div className="grid grid--cards">
              {masCercanas.map((c) => (
                <Link
                  key={c.id}
                  to={`/ciudad/${c.slug}`}
                  className="card card--interactive"
                  style={{ textDecoration: 'none' }}
                  onClick={() => {
                    fijarCiudadGuardada(c.slug)
                    if (!ubicacion) {
                      const coord = coordenadaDeCiudad(c.slug)
                      if (coord) fijarUbicacion(coord)
                    }
                  }}
                >
                  <div className="card__body">
                    <div className="row">
                      <MapPin size={15} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
                      <span className="deflist__label truncate">{c.departamento}</span>
                      <div className="spacer" />
                      {c.distanciaKm != null && (
                        <span
                          className="num"
                          style={{
                            fontSize: 'var(--text-sm)',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                          }}
                        >
                          {formatearDistancia(c.distanciaKm)}
                        </span>
                      )}
                    </div>
                    <h3 className="card__title">{c.nombre}</h3>
                  </div>
                  <div className="card__footer">
                    <span style={{ fontWeight: 650, color: 'var(--accion)' }}>Ver centros</span>
                    <div className="spacer" />
                    <ChevronRight size={17} style={{ color: 'var(--accion)' }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <SelectorCiudad abierto={selectorAbierto} alCerrar={() => setSelectorAbierto(false)} />
    </>
  )
}
