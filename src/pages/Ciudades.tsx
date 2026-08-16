import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ChevronRight, LocateFixed, MapPin, Search, TriangleAlert } from 'lucide-react'
import { PageHeader, EmptyState, SkeletonLinea, Notice } from '@/components/ui'
import { FuentesDeLaPantalla } from '@/components/Fuente'
import { usePreferencias } from '@/state/preferencias'
import { useCiudadesCercanas } from '@/datos/useDatosCiudad'
import { coordenadaDeCiudad, formatearDistancia, obtenerUbicacion } from '@/lib/geo'
import { conteo } from '@/lib/format'

const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalizar(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(DIACRITICOS, '')
}

export function Ciudades() {
  const { ubicacion, fijarUbicacion, fijarCiudadGuardada } = usePreferencias()
  const { ciudades, cargando, error } = useCiudadesCercanas(ubicacion)
  const [busqueda, setBusqueda] = useState('')
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null)

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return ciudades
    return ciudades.filter(
      (c) => normalizar(c.nombre).includes(q) || normalizar(c.departamento).includes(q),
    )
  }, [ciudades, busqueda])

  async function usarUbicacion() {
    setErrorUbicacion(null)
    try {
      fijarUbicacion(await obtenerUbicacion())
    } catch (e) {
      setErrorUbicacion((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Building2 size={13} strokeWidth={2.6} />
            Directorio nacional
          </>
        }
        titulo="Municipios"
        subtitulo="Todos los municipios que tienen centros de acopio registrados. Elige el tuyo para ver qué necesitan."
        acciones={
          !ubicacion ? (
            <button type="button" className="btn btn--primary" onClick={usarUbicacion}>
              <LocateFixed size={18} />
              <span>Ordenar por cercanía</span>
            </button>
          ) : undefined
        }
      />

      <div className="container">
        <FuentesDeLaPantalla origenes={['ayudas-pereira']} nota="Los municipios y sus centros los publica el equipo que coordina cada centro, no la comunidad." />

        {errorUbicacion && (
          <div className="stack">
            <Notice tono="warning">{errorUbicacion}</Notice>
          </div>
        )}

        <div className="row row--wrap" style={{ marginBottom: 'var(--sp-5)' }}>
          <div className="search">
            <Search size={17} className="search__icon" />
            <input
              className="input"
              type="search"
              placeholder="Buscar municipio o departamento"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar municipio"
            />
          </div>
          <span className="section__count" style={{ flexShrink: 0 }}>
            {cargando ? 'Cargando…' : conteo(filtradas.length, 'municipio', 'municipios')}
          </span>
        </div>

        {error ? (
          <EmptyState
            tono="critical"
            icono={TriangleAlert}
            titulo="No pudimos cargar el directorio"
            texto="Revisa tu conexión e inténtalo otra vez."
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
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="panel" style={{ padding: 'var(--sp-5)' }}>
                <SkeletonLinea ancho="55%" alto={20} />
                <div style={{ height: 10 }} />
                <SkeletonLinea ancho="38%" />
              </div>
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <EmptyState
            icono={Search}
            titulo="Sin resultados"
            texto={`Ningún municipio coincide con "${busqueda}". Revisa la escritura o busca por departamento.`}
            acciones={
              <button type="button" className="btn btn--primary" onClick={() => setBusqueda('')}>
                <span>Ver todos</span>
              </button>
            }
          />
        ) : (
          <div className="grid grid--cards">
            {filtradas.map((c) => (
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
      </div>
    </>
  )
}
