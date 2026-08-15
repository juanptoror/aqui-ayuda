import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Building2,
  ChevronRight,
  HandHeart,
  LocateFixed,
  MapPin,
  Package,
  TriangleAlert,
} from 'lucide-react'
import { SectionHead, EmptyState, SkeletonLinea, Notice } from '@/components/ui'
import { SelectorCiudad } from '@/components/SelectorCiudad'
import { Isotipo, LockupVertical } from '@/components/Marca'
import { TarjetaFuente } from '@/components/Fuente'
import { PanoramaCorag } from '@/components/PanoramaCorag'
import { usePreferencias } from '@/state/preferencias'
import { useCiudadesCercanas } from '@/datos/useDatosCiudad'
import { obtenerUbicacion, formatearDistancia, coordenadaDeCiudad } from '@/lib/geo'
import { conteo } from '@/lib/format'

const PASOS = [
  {
    icono: MapPin,
    titulo: 'Dinos dónde estás',
    texto: 'Con tu ubicación o eligiendo tu municipio. No pedimos nada más.',
  },
  {
    icono: Package,
    titulo: 'Mira qué falta de verdad',
    texto: 'Cada centro publica lo que necesita y lo que ya tiene cubierto.',
  },
  {
    icono: HandHeart,
    titulo: 'Actúa sobre seguro',
    texto: 'Cómo llegar, a quién escribir y si está abierto ahora mismo.',
  },
]

/**
 * Portada. La acción va ARRIBA y el relato debajo, no al revés: quien entra
 * aquí después de un terremoto necesita el buscador en la primera pantalla, no
 * un manifiesto. Lo que explica el proyecto viene después, para quien lo busca.
 */
export function Landing() {
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const { ubicacion, fijarUbicacion, ciudadGuardada, fijarCiudadGuardada } = usePreferencias()
  const { ciudades, cargando, error } = useCiudadesCercanas(ubicacion)

  const [buscando, setBuscando] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null)
  const [selectorAbierto, setSelectorAbierto] = useState(false)

  // Compatibilidad con los enlaces ya compartidos del formato /?ciudad=slug.
  const ciudadEnQuery = params.get('ciudad')
  useEffect(() => {
    if (ciudadEnQuery) navegar(`/ciudad/${ciudadEnQuery}`, { replace: true })
  }, [ciudadEnQuery, navegar])

  async function usarMiUbicacion() {
    setBuscando(true)
    setErrorUbicacion(null)
    try {
      fijarUbicacion(await obtenerUbicacion())
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
      {/* ------------------------------- HERO ------------------------------- */}
      <header className="hero">
        <div className="container hero__inner">
          {/* La portada es el único sitio donde el nombre no aparece ya escrito
              al lado, así que aquí va el lockup completo y no el pin suelto.
              De una tinta, con `--brand-on-soft`: negro sobre el claro y
              amarillo sobre el oscuro, que es la regla del kit. */}
          <LockupVertical alto={132} color="var(--brand-on-soft)" title="AquíAyuda" />

          <h1 className="hero__titulo">
            Tú puedes
            <br />
            ayudar aquí
          </h1>

          <p className="hero__texto">
            Centralizamos la información de las ayudas tras el terremoto para que llegue donde
            hace falta. Encuentra el centro de acopio más cercano, mira qué está pidiendo y cómo
            llegar. <strong>Sin registrarte.</strong>
          </p>

          <div className="hero__acciones">
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
          </div>

          <p className="hero__pie">
            {cargando
              ? 'Cargando municipios…'
              : `Disponible en ${conteo(ciudades.length, 'municipio', 'municipios')} de Colombia`}
          </p>
        </div>
      </header>

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

        {/* Las cifras van ANTES de los caminos: primero se ve el tamaño de lo
            que pasa, y solo después se pregunta qué quiere hacer uno. Al revés
            —la crítica que ya nos hicieron— era pedir una decisión a ciegas. */}
        <PanoramaCorag />

        {/* --------------------------- LOS DOS CAMINOS --------------------------- */}
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
                    ['--empty-icon-bg' as string]: 'var(--critical-solid)',
                    ['--empty-icon-fg' as string]: '#000',
                  }}
                >
                  <Package size={26} strokeWidth={2} />
                </span>
                <h3 className="card__title">Necesito ayuda</h3>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Centros abiertos cerca de ti, qué tienen disponible y a qué teléfono llamar.
                </p>
              </div>
              <div className="card__footer">
                <span style={{ fontWeight: 700, color: 'var(--accion)' }}>Ver centros abiertos</span>
                <div className="spacer" />
                <ChevronRight size={18} style={{ color: 'var(--accion)' }} />
              </div>
            </Link>

            <Link to="/como-ayudar" className="card card--interactive" style={{ textDecoration: 'none' }}>
              <div className="card__body">
                <span className="empty__icon">
                  <HandHeart size={26} strokeWidth={2} />
                </span>
                <h3 className="card__title">Quiero ayudar</h3>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Qué hace falta de verdad en cada municipio, antes de comprar o mover nada.
                </p>
              </div>
              <div className="card__footer">
                <span style={{ fontWeight: 700, color: 'var(--accion)' }}>Ver qué falta</span>
                <div className="spacer" />
                <ChevronRight size={18} style={{ color: 'var(--accion)' }} />
              </div>
            </Link>
          </div>
        </section>

        {/* ------------------------------ MUNICIPIOS ----------------------------- */}
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
                    <span style={{ fontWeight: 700, color: 'var(--accion)' }}>Ver centros</span>
                    <div className="spacer" />
                    <ChevronRight size={17} style={{ color: 'var(--accion)' }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ------------------------------ CÓMO FUNCIONA -------------------------- */}
        <section className="section">
          <SectionHead titulo="Cómo funciona" />
          <div className="grid grid--cards">
            {PASOS.map((p, i) => (
              <article key={p.titulo} className="card">
                <div className="card__body">
                  <div className="row">
                    <span className="paso__numero">{i + 1}</span>
                    <p.icono size={18} style={{ color: 'var(--text-subtle)' }} />
                  </div>
                  <h3 className="card__title">{p.titulo}</h3>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>{p.texto}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ---------------------------- DE DÓNDE SALEN --------------------------- */}
        <section className="section">
          <SectionHead titulo="De dónde salen los datos" />
          <p className="section__desc">
            AquíAyuda no inventa información: la reúne de dos fuentes abiertas e independientes.
            Cada dato que ves lleva el sello de la suya, para que sepas quién lo publicó y a quién
            acudir si algo no cuadra.
          </p>
          <div className="grid grid--halves">
            <TarjetaFuente
              origen="ayudas-pereira"
              extra="Municipios, centros de acopio, qué necesitan y su inventario."
            />
            <TarjetaFuente
              origen="corag"
              extra="La pantalla de ayuda entre personas y el formulario para publicar."
            />
          </div>
        </section>

        {/* -------------------------------- CIERRE ------------------------------ */}
        <section className="section">
          <div className="cierre">
            <Isotipo alto={44} />
            <h2 className="cierre__titulo">Cualquiera puede ayudar</h2>
            <p className="cierre__texto">
              No hace falta traer nada: compartir esta página con quien esté cerca de un centro ya
              sirve.
            </p>
            <div className="empty__actions">
              <Link className="btn btn--primary btn--lg" to="/ciudades">
                <span>Buscar mi municipio</span>
              </Link>
              <Link className="btn btn--lg" to="/acerca">
                <span>Acerca del proyecto</span>
              </Link>
            </div>
          </div>
        </section>
      </div>

      <SelectorCiudad abierto={selectorAbierto} alCerrar={() => setSelectorAbierto(false)} />
    </>
  )
}
