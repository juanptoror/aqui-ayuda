import { useMemo, useState } from 'react'
import { BedDouble, Home, MapPin, MessageCircle, Plus, SlidersHorizontal, X } from 'lucide-react'
import {
  PageHeader,
  SectionHead,
  EmptyState,
  AvisoError,
  Badge,
  SkeletonTarjeta,
} from '@/components/ui'
import { PublicarVivienda } from '@/components/formularios/PublicarVivienda'
import { ComoLlegar } from '@/components/ComoLlegar'
import { SelloFuente, FuentesDeLaPantalla } from '@/components/Fuente'
import { MapaPuntos, type PuntoMapa } from '@/components/MapaPuntos'
import { useAlojamientos } from '@/datos/consultas'
import { usePreferencias } from '@/state/preferencias'
import { distanciaKm } from '@/lib/geo'
import { conteo, numero } from '@/lib/format'
import type { Alojamiento } from '@/dominio/modelos'

/**
 * Dónde vivir cuando la casa se cayó.
 *
 * Junta las dos fuentes que publican arriendos, que no se pisan: 82 avisos de
 * Risaralda con coordenada real y precio, y 30 del Quindío con fotos. Ni un
 * duplicado posible —están en departamentos distintos— y el doble de oferta
 * para quien se quedó sin casa.
 *
 * Cada tarjeta dice de dónde viene, porque las dos fuentes tienen calidades
 * distintas: una sabe dónde está el inmueble y la otra enseña cómo es. Saberlo
 * cambia a quién reclamas si el dato está mal.
 */

interface Filtros {
  texto: string
  tipo: string | null
  ciudad: string | null
  precioMax: number | null
  soloAmoblado: boolean
  soloConFoto: boolean
  soloConUbicacion: boolean
}

const VACIO: Filtros = {
  texto: '',
  tipo: null,
  ciudad: null,
  precioMax: null,
  soloAmoblado: false,
  soloConFoto: false,
  soloConUbicacion: false,
}

const TRAMOS = [700_000, 1_000_000, 1_500_000, 2_500_000]

function precioDe(a: Alojamiento): string {
  if (a.precioMes) return `$${numero(a.precioMes)}`
  if (a.precioEnTexto) return a.precioEnTexto
  return 'Precio a consultar'
}

function TarjetaAlojamiento({ a, distancia }: { a: Alojamiento; distancia: number | null }) {
  const foto = a.fotos[0]
  const wa = a.telefono
    ? `https://wa.me/${a.telefono.replace(/\D/g, '').replace(/^(?!57)/, '57')}?text=${encodeURIComponent(
        `Hola, vi tu publicación "${a.titulo}" en AquíAyuda y me interesa.`,
      )}`
    : null

  /* Solo lo que tiene valor. Un 0 en estos campos significa "no lo rellenaron",
     no "no tiene", y escribir "0 habitaciones" sería inventarse un dato. */
  const rasgos = [
    a.habitaciones ? conteo(a.habitaciones, 'habitación', 'habitaciones') : null,
    a.banos ? conteo(a.banos, 'baño', 'baños') : null,
    a.parqueaderos ? conteo(a.parqueaderos, 'parqueadero', 'parqueaderos') : null,
    a.areaM2 ? `${a.areaM2} m²` : null,
    a.amoblado === true ? 'Amoblado' : a.amoblado === false ? 'Sin amoblar' : null,
  ].filter(Boolean) as string[]

  return (
    <article className="card">
      <span className="card__accent" data-origen={a.origen} aria-hidden="true" />
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
          <Badge tono="neutral">{a.tipo}</Badge>
          {distancia != null && (
            <span className="num" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              a {distancia < 1 ? `${Math.round(distancia * 1000)} m` : `${distancia.toFixed(1)} km`}
            </span>
          )}
        </div>

        <h3 className="card__title clamp-2">{a.titulo}</h3>

        <div className="row row--wrap" style={{ gap: 'var(--sp-3)' }}>
          <span className="num" style={{ fontWeight: 800, fontSize: '1.25rem' }}>
            {precioDe(a)}
          </span>
          {(a.precioMes || a.precioEnTexto) && (
            <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>al mes</span>
          )}
        </div>

        <div style={{ color: 'var(--text-muted)' }}>
          {rasgos.length > 0 ? (
            rasgos.join(' · ')
          ) : (
            <span style={{ color: 'var(--text-subtle)' }}>Sin detallar: pregúntalo al escribir</span>
          )}
        </div>

        <div style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
          {[a.barrio, a.ciudad, a.departamento].filter(Boolean).join(' · ')}
        </div>

        {a.descripcion && a.descripcion !== a.barrio && (
          <p className="clamp-2" style={{ color: 'var(--text-muted)', margin: 0 }}>
            {a.descripcion}
          </p>
        )}
      </div>

      <div className="card__footer">
        <SelloFuente origen={a.origen} />
        <ComoLlegar
          destino={{
            lat: a.lat,
            lng: a.lng,
            direccion: a.direccion ?? a.barrio,
            zona: a.ciudad,
            nombre: a.titulo,
          }}
          modo="ver"
          variante="enlace"
          etiqueta={a.lat ? 'Ver en el mapa' : 'Ver la zona'}
        />
        <div className="spacer" />
        {wa ? (
          <a className="btn btn--sm btn--primary" href={wa} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={15} />
            <span>Escribir</span>
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

export function Vivienda() {
  const { ubicacion } = usePreferencias()
  const [f, setF] = useState<Filtros>(VACIO)
  const [publicando, setPublicando] = useState(false)
  const [verMapa, setVerMapa] = useState(false)

  const q = useAlojamientos()
  const todos = q.data ?? []

  const ciudades = useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const a of todos) cuenta.set(a.ciudad, (cuenta.get(a.ciudad) ?? 0) + 1)
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1])
  }, [todos])

  const tipos = useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const a of todos) cuenta.set(a.tipo, (cuenta.get(a.tipo) ?? 0) + 1)
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1])
  }, [todos])

  const conDistancia = useMemo(
    () =>
      todos.map((a) => ({
        a,
        distancia:
          ubicacion && a.lat != null && a.lng != null
            ? distanciaKm(ubicacion, { lat: a.lat, lng: a.lng })
            : null,
      })),
    [todos, ubicacion],
  )

  const resultados = useMemo(() => {
    const texto = f.texto.trim().toLowerCase()
    const lista = conDistancia.filter(({ a }) => {
      if (f.tipo && a.tipo !== f.tipo) return false
      if (f.ciudad && a.ciudad !== f.ciudad) return false
      if (f.soloAmoblado && a.amoblado !== true) return false
      if (f.soloConFoto && a.fotos.length === 0) return false
      if (f.soloConUbicacion && a.lat == null) return false
      if (f.precioMax != null && (a.precioMes == null || a.precioMes > f.precioMax)) return false
      if (texto) {
        const heno = [a.titulo, a.descripcion, a.barrio, a.ciudad, a.tipo]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!heno.includes(texto)) return false
      }
      return true
    })

    // Con ubicación, lo más cerca primero; sin ella, lo más nuevo.
    return lista.sort((x, y) => {
      if (x.distancia != null && y.distancia != null) return x.distancia - y.distancia
      if (x.distancia != null) return -1
      if (y.distancia != null) return 1
      return y.a.publicadoEn.localeCompare(x.a.publicadoEn)
    })
  }, [conDistancia, f])

  const sinPrecio = todos.filter((a) => a.precioMes == null).length
  const activos = [
    f.tipo && { clave: 'tipo' as const, texto: f.tipo },
    f.ciudad && { clave: 'ciudad' as const, texto: f.ciudad },
    f.precioMax != null && { clave: 'precioMax' as const, texto: `hasta $${numero(f.precioMax)}` },
    f.soloAmoblado && { clave: 'soloAmoblado' as const, texto: 'Amoblado' },
    f.soloConFoto && { clave: 'soloConFoto' as const, texto: 'Con fotos' },
    f.soloConUbicacion && { clave: 'soloConUbicacion' as const, texto: 'Con ubicación' },
    f.texto.trim() && { clave: 'texto' as const, texto: `"${f.texto.trim()}"` },
  ].filter(Boolean) as { clave: keyof Filtros; texto: string }[]

  function quitar(clave: keyof Filtros) {
    setF({ ...f, [clave]: clave === 'texto' ? '' : typeof f[clave] === 'boolean' ? false : null })
  }

  const puntos: PuntoMapa[] = resultados
    .filter(({ a }) => a.lat != null && a.lng != null)
    .map(({ a }) => ({
      id: a.id,
      lat: a.lat!,
      lng: a.lng!,
      titulo: a.titulo,
      detalle: `${precioDe(a)} · ${[a.barrio, a.ciudad].filter(Boolean).join(' · ')}`,
      origen: 'pereira-unida',
    }))

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <BedDouble size={13} strokeWidth={2.6} />
            Dónde vivir
          </>
        }
        titulo="Vivienda en arriendo"
        subtitulo={
          q.isLoading
            ? 'Consultando las dos fuentes de vivienda…'
            : `${conteo(todos.length, 'sitio disponible', 'sitios disponibles')} entre ${conteo(ciudades.length, 'municipio', 'municipios')}. Quien perdió la casa necesita otra, no una caja más.`
        }
        acciones={
          <>
            <button type="button" className="btn btn--primary" onClick={() => setPublicando(true)}>
              <Plus size={18} />
              <span>Publicar</span>
            </button>
            {puntos.length > 0 && (
              <button type="button" className="btn" onClick={() => setVerMapa((v) => !v)}>
                <MapPin size={18} />
                <span>{verMapa ? 'Ver lista' : 'Ver mapa'}</span>
              </button>
            )}
          </>
        }
      />

      <div className="container">
        {q.error ? (
          <div className="stack">
            <AvisoError error={q.error} origen="VI" />
          </div>
        ) : null}

        {!q.isLoading && !q.error && (
          <FuentesDeLaPantalla
            origenes={['pereira-unida', 'vivienda']}
            nota="Dos listados distintos, sin solape: uno cubre Risaralda y sabe dónde está cada sitio; el otro cubre el Quindío y trae fotos."
          />
        )}

        {/* ------------------------------- FILTROS ------------------------------ */}
        <section className="section" aria-label="Filtros">
          <div className="filtros">
            <div className="filtros__buscar">
              <input
                className="input"
                type="search"
                aria-label="Buscar vivienda"
                placeholder="Barrio, tipo, lo que sea…"
                value={f.texto}
                onChange={(e) => setF({ ...f, texto: e.target.value })}
              />
            </div>

            <details className="filtros__mas">
              <summary className="btn">
                <SlidersHorizontal size={17} />
                <span>Filtros{activos.length > 0 ? ` (${activos.length})` : ''}</span>
              </summary>

              <div className="filtros__panel">
                <div className="filtros__grupo">
                  <span className="deflist__label">Tipo</span>
                  <div className="chips">
                    {tipos.map(([t, n]) => (
                      <button
                        key={t}
                        type="button"
                        className="chip"
                        aria-pressed={f.tipo === t}
                        onClick={() => setF({ ...f, tipo: f.tipo === t ? null : t })}
                      >
                        <span>{t}</span>
                        <span className="num">{n}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filtros__grupo">
                  <span className="deflist__label">Municipio</span>
                  <div className="chips">
                    {ciudades.map(([c, n]) => (
                      <button
                        key={c}
                        type="button"
                        className="chip"
                        aria-pressed={f.ciudad === c}
                        onClick={() => setF({ ...f, ciudad: f.ciudad === c ? null : c })}
                      >
                        <span>{c}</span>
                        <span className="num">{n}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filtros__grupo">
                  <span className="deflist__label">Canon máximo</span>
                  <div className="chips">
                    {TRAMOS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className="chip"
                        aria-pressed={f.precioMax === p}
                        onClick={() => setF({ ...f, precioMax: f.precioMax === p ? null : p })}
                      >
                        <span>${numero(p)}</span>
                      </button>
                    ))}
                  </div>
                  {f.precioMax != null && sinPrecio > 0 && (
                    <p className="filtros__aviso">
                      {sinPrecio} de {todos.length} no publican el canon como número, así que este
                      filtro los deja fuera. No es que no existan.
                    </p>
                  )}
                </div>

                <div className="filtros__grupo">
                  <span className="deflist__label">Solo mostrar</span>
                  <div className="chips">
                    <button
                      type="button"
                      className="chip"
                      aria-pressed={f.soloAmoblado}
                      onClick={() => setF({ ...f, soloAmoblado: !f.soloAmoblado })}
                    >
                      <span>Amoblado</span>
                    </button>
                    <button
                      type="button"
                      className="chip"
                      aria-pressed={f.soloConFoto}
                      onClick={() => setF({ ...f, soloConFoto: !f.soloConFoto })}
                    >
                      <span>Con fotos</span>
                    </button>
                    <button
                      type="button"
                      className="chip"
                      aria-pressed={f.soloConUbicacion}
                      onClick={() => setF({ ...f, soloConUbicacion: !f.soloConUbicacion })}
                    >
                      <span>Con ubicación exacta</span>
                    </button>
                  </div>
                </div>
              </div>
            </details>
          </div>

          {/* Los filtros puestos, siempre visibles y quitables de uno en uno.
              Escondidos dentro del desplegable, la gente no entiende por qué la
              lista está vacía. */}
          {activos.length > 0 && (
            <div className="chips" style={{ marginTop: 'var(--sp-4)' }}>
              {activos.map((a) => (
                <button
                  key={a.clave}
                  type="button"
                  className="chip chip--quitar"
                  onClick={() => quitar(a.clave)}
                  aria-label={`Quitar filtro ${a.texto}`}
                >
                  <span>{a.texto}</span>
                  <X size={13} strokeWidth={2.6} />
                </button>
              ))}
              <button type="button" className="chip" onClick={() => setF(VACIO)}>
                <span>Quitar todos</span>
              </button>
            </div>
          )}
        </section>

        <section className="section">
          <SectionHead
            titulo={verMapa ? 'En el mapa' : 'Resultados'}
            conteo={q.isLoading ? undefined : conteo(resultados.length, 'sitio', 'sitios')}
          />

          {q.isLoading ? (
            <div className="grid grid--cards">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonTarjeta key={i} />
              ))}
            </div>
          ) : resultados.length === 0 ? (
            <EmptyState
              icono={Home}
              titulo={activos.length ? 'Nada encaja con esos filtros' : 'Todavía no hay nada'}
              texto={
                activos.length
                  ? 'Prueba a quitar alguno de arriba. El listado aún está creciendo.'
                  : 'Si tienes un sitio libre, publicarlo puede resolverle el mes a una familia.'
              }
              acciones={
                activos.length ? (
                  <button type="button" className="btn btn--primary" onClick={() => setF(VACIO)}>
                    <span>Quitar filtros</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => setPublicando(true)}
                  >
                    <span>Publicar vivienda</span>
                  </button>
                )
              }
            />
          ) : verMapa ? (
            <>
              <MapaPuntos puntos={puntos} yoEstoyAqui={ubicacion} />
              {resultados.length > puntos.length && (
                <p className="filtros__aviso" style={{ marginTop: 'var(--sp-3)' }}>
                  {resultados.length - puntos.length} de estos {resultados.length} sitios no salen en
                  el mapa: su fuente no publica una coordenada de fiar. Están en la lista.
                </p>
              )}
            </>
          ) : (
            <div className="grid grid--cards">
              {resultados.map(({ a, distancia }) => (
                <TarjetaAlojamiento key={a.id} a={a} distancia={distancia} />
              ))}
            </div>
          )}
        </section>
      </div>

      <PublicarVivienda
        abierto={publicando}
        alCerrar={() => setPublicando(false)}
        alPublicar={() => {
          setPublicando(false)
          q.refetch()
        }}
        ciudadesConocidas={ciudades.map(([c]) => c)}
      />
    </>
  )
}
