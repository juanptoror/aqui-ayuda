import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BedDouble, Home, MessageCircle, Plus } from 'lucide-react'
import {
  PageHeader,
  SectionHead,
  EmptyState,
  AvisoError,
  Badge,
  Notice,
  SkeletonTarjeta,
} from '@/components/ui'
import { PublicarVivienda } from '@/components/formularios/PublicarVivienda'
import { ComoLlegar } from '@/components/ComoLlegar'
import { leerInmuebles, enlaceArrendador, type Inmueble } from '@/backends/vivienda'
import { conteo, numero } from '@/lib/format'

/**
 * Dónde vivir cuando la casa se cayó.
 *
 * Es la necesidad que ninguna de las otras fuentes cubre: los centros de acopio
 * dan comida y cobijas, pero nadie da un techo de más de una noche.
 *
 * Dos honestidades que la pantalla tiene que sostener, y que salen de haber
 * medido los datos en vez de suponerlos:
 * - **No hay mapa.** Las coordenadas del origen son un valor por defecto que
 *   apunta a Bogotá, y los inmuebles están en Armenia. Se enseña ciudad y
 *   barrio, y el enlace al mapa se hace por texto, no por coordenada.
 * - **El precio falta en el campo en 23 de 30 anuncios**, aunque casi todos lo
 *   escriben en la descripción. El filtro de precio lo dice antes de aplicarse,
 *   en vez de esconder dos tercios del listado sin avisar.
 */

interface Filtros {
  texto: string
  tipo: string | null
  ciudad: string | null
  habitacionesMin: number | null
  conParqueadero: boolean
  precioMax: number | null
}

const VACIO: Filtros = {
  texto: '',
  tipo: null,
  ciudad: null,
  habitacionesMin: null,
  conParqueadero: false,
  precioMax: null,
}

function TarjetaInmueble({ i }: { i: Inmueble }) {
  const wa = enlaceArrendador(i.whatsapp, i.titulo)
  const foto = i.imagenes[0]

  return (
    <article className="card">
      {foto && (
        <img
          className="card__foto"
          src={foto}
          alt=""
          loading="lazy"
          /* Una imagen rota deja un icono de fichero partido en medio de la
             tarjeta. Mejor que desaparezca y quede el texto, que es lo útil. */
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      <div className="card__body">
        <div className="row row--wrap">
          <Badge tono="neutral">{i.tipo}</Badge>
          {i.contactos > 0 && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)' }}>
              {conteo(i.contactos, 'persona ya preguntó', 'personas ya preguntaron')}
            </span>
          )}
        </div>

        <h3 className="card__title clamp-2">{i.titulo}</h3>

        <div className="row row--wrap" style={{ gap: 'var(--sp-4)' }}>
          <span className="num" style={{ fontWeight: 800, fontSize: '1.25rem' }}>
            {i.precio
              ? `$${numero(i.precio)}`
              : i.precioEnTexto
                ? i.precioEnTexto
                : 'Precio a consultar'}
          </span>
          {(i.precio || i.precioEnTexto) && (
            <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>al mes</span>
          )}
        </div>

        {/* Solo lo que tiene valor. En 22 de los 30 anuncios estos campos son
            0, y un 0 aquí no significa "cero habitaciones": significa que nadie
            lo rellenó. Escribir "0 habitaciones" sería inventarse un dato. */}
        {(() => {
          const rasgos = [
            i.habitaciones > 0 ? conteo(i.habitaciones, 'habitación', 'habitaciones') : null,
            i.banos > 0 ? conteo(i.banos, 'baño', 'baños') : null,
            i.parqueaderos > 0 ? conteo(i.parqueaderos, 'parqueadero', 'parqueaderos') : null,
            i.areaM2 ? `${i.areaM2} m²` : null,
          ].filter(Boolean) as string[]

          return (
            <div style={{ color: 'var(--text-muted)' }}>
              {rasgos.length > 0 ? (
                rasgos.join(' · ')
              ) : (
                <span style={{ color: 'var(--text-subtle)' }}>
                  Sin detallar: pregúntalo al escribir
                </span>
              )}
            </div>
          )
        })()}

        <div style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
          {[i.barrio, i.ciudad].filter(Boolean).join(' · ')}
        </div>

        {i.descripcion && (
          <p className="clamp-3" style={{ color: 'var(--text-muted)', margin: 0 }}>
            {i.descripcion}
          </p>
        )}
      </div>

      <div className="card__footer">
        {/* Por texto y no por coordenada: las de la fuente son falsas. */}
        <ComoLlegar
          destino={{ direccion: i.barrio, zona: i.ciudad }}
          modo="ver"
          variante="enlace"
          etiqueta="Ver la zona"
        />
        <div className="spacer" />
        {wa ? (
          <a
            className="btn btn--sm btn--primary"
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={15} />
            <span>Escribir</span>
          </a>
        ) : (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)' }}>
            Sin contacto publicado
          </span>
        )}
      </div>
    </article>
  )
}

export function Vivienda() {
  const [f, setF] = useState<Filtros>(VACIO)
  const [publicando, setPublicando] = useState(false)

  const q = useQuery({
    queryKey: ['inmuebles'],
    queryFn: leerInmuebles,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const todos = q.data ?? []

  const ciudades = useMemo(
    () => [...new Set(todos.map((i) => i.ciudad))].sort((a, b) => a.localeCompare(b, 'es')),
    [todos],
  )
  const tipos = useMemo(
    () => [...new Set(todos.map((i) => i.tipo))].sort((a, b) => a.localeCompare(b, 'es')),
    [todos],
  )

  /* Cuántos anuncios se quedarían fuera de cada filtro por no haber rellenado
     el campo. Sin esto, filtrar por "2 habitaciones" devuelve casi nada y
     parece que no hay oferta, cuando lo que no hay es dato. */
  const sinPrecioEnCampo = todos.filter((i) => i.precio == null).length
  const sinHabitaciones = todos.filter((i) => i.habitaciones === 0).length

  const resultados = useMemo(() => {
    const texto = f.texto.trim().toLowerCase()
    return todos.filter((i) => {
      if (f.tipo && i.tipo !== f.tipo) return false
      if (f.ciudad && i.ciudad !== f.ciudad) return false
      if (f.habitacionesMin != null && i.habitaciones < f.habitacionesMin) return false
      if (f.conParqueadero && i.parqueaderos < 1) return false
      /* Filtrar por precio descarta los que no lo publican en el campo. Eso se
         avisa arriba: es la diferencia entre "no hay nada barato" y "no lo
         sabemos". */
      if (f.precioMax != null && (i.precio == null || i.precio > f.precioMax)) return false
      if (texto) {
        const heno = [i.titulo, i.descripcion, i.barrio, i.ciudad, i.tipo]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!heno.includes(texto)) return false
      }
      return true
    })
  }, [todos, f])

  const hayFiltro =
    f.tipo || f.ciudad || f.habitacionesMin != null || f.conParqueadero || f.precioMax != null || f.texto

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
            ? 'Consultando inmuebles disponibles…'
            : `${conteo(todos.length, 'inmueble publicado', 'inmuebles publicados')}${
                ciudades.length > 0 ? ` en ${ciudades.slice(0, 3).join(', ')}` : ''
              }. Quien perdió la casa necesita otra, no una caja más.`
        }
        acciones={
          <button type="button" className="btn btn--primary" onClick={() => setPublicando(true)}>
            <Plus size={18} />
            <span>Publicar vivienda</span>
          </button>
        }
      />

      <div className="container">
        {q.error ? (
          <div className="stack">
            <AvisoError error={q.error} origen="VI" />
          </div>
        ) : null}

        <section className="section" style={{ marginTop: 0 }}>
          <SectionHead titulo="Buscar" />

          <div className="stack">
            <div className="field">
              <label className="field__label" htmlFor="buscar-vivienda">
                Buscar por texto
              </label>
              <input
                id="buscar-vivienda"
                className="input"
                type="search"
                placeholder="Barrio, tipo, lo que sea"
                value={f.texto}
                onChange={(e) => setF({ ...f, texto: e.target.value })}
              />
            </div>

            {tipos.length > 1 && (
              <div>
                <span className="deflist__label">Tipo</span>
                <div className="chips" style={{ marginTop: 'var(--sp-2)' }}>
                  {tipos.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="chip"
                      aria-pressed={f.tipo === t}
                      onClick={() => setF({ ...f, tipo: f.tipo === t ? null : t })}
                    >
                      <span>{t}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ciudades.length > 1 && (
              <div>
                <span className="deflist__label">Ciudad</span>
                <div className="chips" style={{ marginTop: 'var(--sp-2)' }}>
                  {ciudades.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="chip"
                      aria-pressed={f.ciudad === c}
                      onClick={() => setF({ ...f, ciudad: f.ciudad === c ? null : c })}
                    >
                      <span>{c}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="deflist__label">Habitaciones</span>
              <div className="chips" style={{ marginTop: 'var(--sp-2)' }}>
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="chip"
                    aria-pressed={f.habitacionesMin === n}
                    onClick={() =>
                      setF({ ...f, habitacionesMin: f.habitacionesMin === n ? null : n })
                    }
                  >
                    <span>{n}+</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="chip"
                  aria-pressed={f.conParqueadero}
                  onClick={() => setF({ ...f, conParqueadero: !f.conParqueadero })}
                >
                  <span>Con parqueadero</span>
                </button>
              </div>
              {(f.habitacionesMin != null || f.conParqueadero) && sinHabitaciones > 0 && (
                <p
                  style={{
                    marginTop: 'var(--sp-2)',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  {sinHabitaciones} de {todos.length} anuncios no dicen cuántas habitaciones tienen.
                  Este filtro los deja fuera aunque quizá te sirvan.
                </p>
              )}
            </div>

            <div>
              <span className="deflist__label">Precio máximo</span>
              <div className="chips" style={{ marginTop: 'var(--sp-2)' }}>
                {[1_000_000, 1_500_000, 2_000_000, 5_000_000].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="chip"
                    aria-pressed={f.precioMax === p}
                    onClick={() => setF({ ...f, precioMax: f.precioMax === p ? null : p })}
                  >
                    <span>hasta ${numero(p)}</span>
                  </button>
                ))}
              </div>
              {f.precioMax != null && sinPrecioEnCampo > 0 && (
                <p
                  style={{
                    marginTop: 'var(--sp-2)',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  Ojo: {sinPrecioEnCampo} de {todos.length} anuncios no ponen el precio en su campo
                  —lo escriben dentro del texto—, así que este filtro los deja fuera. No es que no
                  existan.
                </p>
              )}
            </div>

            {hayFiltro && (
              <div className="row">
                <button type="button" className="btn btn--sm" onClick={() => setF(VACIO)}>
                  <span>Quitar filtros</span>
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="section">
          <SectionHead
            titulo="Resultados"
            conteo={q.isLoading ? undefined : conteo(resultados.length, 'inmueble', 'inmuebles')}
          />

          {!q.isLoading && !q.error && (
            <Notice tono="info">
              Este listado no lleva mapa a propósito: las coordenadas que publica la fuente son un
              valor por defecto que apunta a otra ciudad. Se muestra el barrio, que sí es real.
            </Notice>
          )}

          {q.isLoading ? (
            <div className="grid grid--cards" style={{ marginTop: 'var(--sp-4)' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonTarjeta key={i} />
              ))}
            </div>
          ) : resultados.length === 0 ? (
            <EmptyState
              icono={Home}
              titulo={hayFiltro ? 'Nada encaja con esos filtros' : 'Todavía no hay inmuebles'}
              texto={
                hayFiltro
                  ? 'Prueba a quitar alguno. El listado es pequeño y aún está creciendo.'
                  : 'Si tienes un inmueble libre, publicarlo aquí puede resolverle el mes a una familia.'
              }
              acciones={
                hayFiltro ? (
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
          ) : (
            <div className="grid grid--cards" style={{ marginTop: 'var(--sp-4)' }}>
              {resultados.map((i) => (
                <TarjetaInmueble key={i.id} i={i} />
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
        ciudadesConocidas={ciudades}
      />
    </>
  )
}
