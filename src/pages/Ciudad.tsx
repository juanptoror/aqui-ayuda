import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  Building2,
  Check,
  Clock,
  DoorOpen,
  HeartHandshake,
  Package,
  PackagePlus,
  RefreshCw,
  Share2,
  TriangleAlert,
  Truck,
} from 'lucide-react'
import {
  PageHeader,
  Kpi,
  AvisoError,
  SectionHead,
  EmptyState,
  SkeletonTarjeta,
} from '@/components/ui'
import { FuentesDeLaPantalla } from '@/components/Fuente'
import { CentroCard } from '@/components/CentroCard'
import { SelectorCiudad } from '@/components/SelectorCiudad'
import { AvisoTelefonos, Acceso } from '@/components/Acceso'
import { OfrecerDonacion } from '@/components/formularios/OfrecerDonacion'
import { ApuntarseVoluntario } from '@/components/formularios/ApuntarseVoluntario'
import { ApuntarVehiculo } from '@/components/formularios/ApuntarVehiculo'
import { usePreferencias } from '@/state/preferencias'
import { useDatosCiudad } from '@/datos/useDatosCiudad'
import { conteo, desde, numero } from '@/lib/format'

type Modo = 'ayudar' | 'recibir'

/** Filtro que aplican los KPIs al pulsarlos. */
type Filtro = 'todos' | 'abiertos' | 'urgentes' | 'pendientes'

const ETIQUETA_FILTRO: Record<Exclude<Filtro, 'todos'>, string> = {
  abiertos: 'abiertos ahora',
  urgentes: 'con pedidos urgentes',
  pendientes: 'con pedidos abiertos',
}

export function Ciudad() {
  const { slug } = useParams<{ slug: string }>()
  const { ubicacion, fijarCiudadGuardada } = usePreferencias()
  const datos = useDatosCiudad(slug, ubicacion)

  const [modo, setModo] = useState<Modo>('ayudar')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [copiado, setCopiado] = useState(false)

  // Formularios de participación.
  const [donando, setDonando] = useState(false)
  const [voluntario, setVoluntario] = useState(false)
  const [vehiculo, setVehiculo] = useState(false)
  const [accesoAbierto, setAccesoAbierto] = useState(false)

  useEffect(() => {
    if (slug && datos.ciudad) fijarCiudadGuardada(slug)
  }, [slug, datos.ciudad, fijarCiudadGuardada])

  // Cambiar de municipio no debe arrastrar filtros del municipio anterior.
  useEffect(() => {
    setCategoria(null)
    setFiltro('todos')
  }, [slug])

  const centrosFiltrados = useMemo(() => {
    let lista = datos.centros

    if (filtro === 'abiertos') lista = lista.filter((c) => c.abierto)
    if (filtro === 'urgentes') lista = lista.filter((c) => c.urgentes > 0)
    if (filtro === 'pendientes') lista = lista.filter((c) => c.pendientes > 0)

    if (categoria) {
      lista = lista.filter((c) =>
        modo === 'ayudar'
          ? c.necesidades.some((n) => n.estado === 'pendiente' && n.categoria === categoria)
          : c.inventario.some((i) => i.categoria === categoria && i.cantidad > 0),
      )
    }
    return lista
  }, [datos.centros, categoria, modo, filtro])

  /**
   * Los filtros están arriba y lo que filtran está debajo del pliegue.
   *
   * Los KPIs y los chips de categoría viven en la cabecera de la pantalla; la
   * lista de centros empieza pasadas dos secciones. Al pulsar "Urgentes" la
   * lista se recortaba sin que se moviera nada de lo que se estaba viendo, así
   * que el botón parecía roto y se volvía a pulsar. En un celular no se ve ni
   * el encabezado con el recuento, que es la confirmación de que sí pasó algo.
   *
   * Solo baja al activar. Al quitar el filtro se queda donde está: quien lo
   * quita ya está mirando la lista y arrastrarlo sería moverle el suelo.
   */
  const listaRef = useRef<HTMLElement | null>(null)

  function irALaLista() {
    const nodo = listaRef.current
    if (!nodo) return
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    /* Un fotograma de margen: la lista se re-renderiza con el filtro puesto y
       el encabezado cambia de recuento antes de que empiece el desplazamiento. */
    requestAnimationFrame(() => {
      nodo.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' })
    })
  }

  /** Pulsar el KPI ya activo lo desactiva: es un interruptor, no un callejón. */
  function alternarFiltro(f: Exclude<Filtro, 'todos'>) {
    const siguiente = filtro === f ? 'todos' : f
    setFiltro(siguiente)
    if (siguiente !== 'todos') irALaLista()
  }

  function alternarCategoria(c: string) {
    const siguiente = categoria === c ? null : c
    setCategoria(siguiente)
    if (siguiente) irALaLista()
  }

  // Ciudad fusionada en otra: se redirige en vez de mostrar una pantalla vacía.
  if (datos.redirigirA) return <Navigate to={`/ciudad/${datos.redirigirA}`} replace />

  if (datos.noEncontrada) {
    return (
      <>
        <PageHeader
          titulo="No encontramos ese municipio"
          subtitulo="El enlace puede estar mal escrito o el municipio se unificó con otro."
        />
        <div className="container">
          <EmptyState
            icono={Building2}
            titulo={`"${slug}" no está en el listado`}
            texto="Elige tu municipio de la lista para ver los centros de acopio activos."
            acciones={
              <>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setSelectorAbierto(true)}
                >
                  <span>Elegir municipio</span>
                </button>
                <Link className="btn" to="/">
                  <span>Ir al inicio</span>
                </Link>
              </>
            }
          />
        </div>
        <SelectorCiudad abierto={selectorAbierto} alCerrar={() => setSelectorAbierto(false)} />
      </>
    )
  }

  const { ciudad, resumen, cargando } = datos

  async function compartir() {
    const url = window.location.href
    const texto = `Centros de acopio en ${ciudad?.nombre ?? 'Colombia'}`
    try {
      if (navigator.share) {
        await navigator.share({ title: texto, url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopiado(true)
        window.setTimeout(() => setCopiado(false), 2500)
      }
    } catch {
      /* el usuario canceló el diálogo de compartir: no es un error */
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Building2 size={13} strokeWidth={2.6} />
            {cargando ? 'Cargando…' : (ciudad?.departamento ?? 'Colombia')}
          </>
        }
        titulo={ciudad?.nombre ?? (cargando ? 'Cargando municipio' : 'Municipio')}
        subtitulo={
          cargando
            ? 'Consultando centros de acopio y necesidades registradas…'
            : `${conteo(resumen.abiertos, 'centro abierto', 'centros abiertos')} de ${numero(resumen.centros)} · ${
                resumen.urgentes > 0
                  ? `${conteo(resumen.urgentes, 'pedido urgente', 'pedidos urgentes')}`
                  : 'sin pedidos urgentes'
              } · actualizado ${desde(resumen.actualizado)}`
        }
        acciones={
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setDonando(true)}
              disabled={!ciudad}
            >
              <PackagePlus size={18} />
              <span>Tengo algo para donar</span>
            </button>
            <button type="button" className="btn" onClick={() => setSelectorAbierto(true)}>
              <Building2 size={18} />
              <span>
                Cambiar<span className="oculto-movil"> municipio</span>
              </span>
            </button>
            <button type="button" className="btn btn--soft" onClick={compartir}>
              {copiado ? <Check size={18} /> : <Share2 size={18} />}
              <span>{copiado ? 'Copiado' : 'Compartir'}</span>
            </button>
          </>
        }
      />

      <div className="container">
        <FuentesDeLaPantalla origenes={['ayudas-pereira']} nota="Todo lo de este municipio —centros, qué piden y qué tienen— sale de una sola fuente." />

        <div className="stack">
          {datos.error ? <AvisoError error={datos.error} origen="AP" /> : null}
          <AvisoTelefonos />
        </div>

        {/* RESUMEN — la estructura se dibuja siempre, con datos o sin ellos. */}
        <section className="section" aria-label="Resumen del municipio">
          <div className="grid grid--kpi">
            <Kpi
              icono={DoorOpen}
              etiqueta="Abiertos"
              valor={numero(resumen.abiertos)}
              pista={
                resumen.centros === 0
                  ? 'Ninguno publicado'
                  : `de ${conteo(resumen.centros, 'centro', 'centros')}`
              }
              tono="success"
              cargando={cargando}
              activo={filtro === 'abiertos'}
              alPulsar={() => alternarFiltro('abiertos')}
            />
            <Kpi
              icono={TriangleAlert}
              etiqueta="Urgentes"
              valor={numero(resumen.urgentes)}
              pista={resumen.urgentes === 0 ? 'Nada urgente' : 'Para hoy'}
              tono="critical"
              cargando={cargando}
              activo={filtro === 'urgentes'}
              alPulsar={resumen.urgentes > 0 ? () => alternarFiltro('urgentes') : undefined}
            />
            <Kpi
              icono={Package}
              etiqueta="Pedidos"
              valor={numero(resumen.pendientes)}
              pista={`En ${conteo(resumen.categoriasFaltantes, 'categoría', 'categorías')}`}
              tono="warning"
              cargando={cargando}
              activo={filtro === 'pendientes'}
              alPulsar={resumen.pendientes > 0 ? () => alternarFiltro('pendientes') : undefined}
            />
            <Kpi
              icono={Clock}
              etiqueta="Actualizado"
              valor={
                resumen.actualizado ? desde(resumen.actualizado).replace('hace ', '') : 'Sin datos'
              }
              pista={resumen.actualizado ? 'Por los centros' : 'Nadie ha reportado'}
              cargando={cargando}
            />
          </div>
        </section>

        {/* SEPARACIÓN DE CAMINOS — la decisión principal, aislada del resumen
            y de los datos. Antes esto estaba mezclado y no se entendía. */}
        <section className="section" aria-label="Elige qué quieres hacer">
          <div
            className="segmented"
            role="tablist"
            aria-label="Modo de uso"
            style={{ maxWidth: 620 }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={modo === 'ayudar'}
              className="segmented__option"
              onClick={() => setModo('ayudar')}
            >
              <HeartHandshake size={19} strokeWidth={2.1} />
              <span>Quiero ayudar</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modo === 'recibir'}
              className="segmented__option"
              onClick={() => setModo('recibir')}
            >
              <Package size={19} strokeWidth={2.1} />
              <span>Necesito ayuda</span>
            </button>
          </div>
        </section>

        {modo === 'ayudar' && datos.categoriasUrgentes.length > 0 && (
          <section className="section">
            <SectionHead titulo="Lo que más falta ahora" />
            <p className="section__desc">
              Ordenado por cantidad de pedidos abiertos. Toca una categoría para ver solo los
              centros que la están pidiendo.
            </p>
            <div className="chips">
              {datos.categoriasUrgentes.slice(0, 8).map((c) => (
                <button
                  key={c.categoria}
                  type="button"
                  className="chip"
                  aria-pressed={categoria === c.categoria}
                  onClick={() => alternarCategoria(c.categoria)}
                >
                  <span>{c.categoria}</span>
                  <span className="num" style={{ opacity: 0.75, flexShrink: 0 }}>
                    {c.total}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Formas de participar que no son llevar una caja: se ofrecen aquí
            porque el transporte y las manos escasean tanto como las cosas. */}
        <section className="section">
          <SectionHead titulo="Otras formas de ayudar" />
          <div className="grid grid--halves">
            <button
              type="button"
              className="card card--interactive"
              onClick={() => setVoluntario(true)}
              style={{ textAlign: 'left' }}
              disabled={!ciudad}
            >
              <div className="card__body">
                <div className="row">
                  <span className="kpi__icon">
                    <HeartHandshake size={17} strokeWidth={2.25} />
                  </span>
                  <span className="deflist__label">Voluntariado</span>
                </div>
                <h3 className="card__title">Quiero poner las manos</h3>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Clasificar, cargar, cocinar o atender. Te llaman cuando hagan falta manos cerca
                  de ti.
                </p>
              </div>
            </button>

            <button
              type="button"
              className="card card--interactive"
              onClick={() => setVehiculo(true)}
              style={{ textAlign: 'left' }}
              disabled={!ciudad}
            >
              <div className="card__body">
                <div className="row">
                  <span className="kpi__icon">
                    <Truck size={17} strokeWidth={2.25} />
                  </span>
                  <span className="deflist__label">Transporte</span>
                </div>
                <h3 className="card__title">Pongo mi carro</h3>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Hay donaciones paradas porque nadie puede moverlas. Si tienes vehículo, esto
                  desatasca más que una caja.
                </p>
              </div>
            </button>
          </div>
        </section>

        <section className="section section--destino-filtro" ref={listaRef}>
          <SectionHead
            titulo={modo === 'ayudar' ? 'Centros que están recibiendo' : 'Centros abiertos cerca de ti'}
            conteo={
              cargando ? undefined : conteo(centrosFiltrados.length, 'centro', 'centros')
            }
            acciones={
              categoria || filtro !== 'todos' ? (
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => {
                    setCategoria(null)
                    setFiltro('todos')
                  }}
                >
                  <RefreshCw size={15} />
                  <span>
                    Quitar filtro
                    {categoria ? `: ${categoria}` : ''}
                    {filtro !== 'todos' ? ` (${ETIQUETA_FILTRO[filtro]})` : ''}
                  </span>
                </button>
              ) : undefined
            }
          />
          <p className="section__desc">
            {ubicacion
              ? 'Ordenados del más cercano al más lejano.'
              : 'Comparte tu ubicación desde el inicio para ordenarlos por cercanía.'}
          </p>

          {cargando ? (
            <div className="grid grid--cards">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonTarjeta key={i} />
              ))}
            </div>
          ) : centrosFiltrados.length === 0 ? (
            categoria ? (
              <EmptyState
                icono={Package}
                titulo={`Ningún centro pide "${categoria}" ahora mismo`}
                texto="Eso es buena señal: esa categoría ya está cubierta en este municipio. Prueba con otra o mira todos los centros."
                acciones={
                  <button type="button" className="btn btn--primary" onClick={() => setCategoria(null)}>
                    <span>Ver todos los centros</span>
                  </button>
                }
              />
            ) : (
              <EmptyState
                icono={Building2}
                titulo="Todavía no hay centros publicados aquí"
                texto={`Nadie ha registrado un centro de acopio en ${ciudad?.nombre ?? 'este municipio'}. Si conoces uno, el equipo local puede publicarlo para que aparezca en esta página.`}
                acciones={
                  <>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => setSelectorAbierto(true)}
                    >
                      <span>Buscar en otro municipio</span>
                    </button>
                    <Link className="btn" to="/como-ayudar">
                      <span>Ver cómo ayudar</span>
                    </Link>
                  </>
                }
              />
            )
          ) : (
            <div className="grid grid--cards">
              {centrosFiltrados.map((c) => (
                <CentroCard key={c.id} centro={c} modo={modo} />
              ))}
            </div>
          )}
        </section>
      </div>

      <SelectorCiudad abierto={selectorAbierto} alCerrar={() => setSelectorAbierto(false)} />

      {ciudad && (
        <>
          <OfrecerDonacion
            abierto={donando}
            alCerrar={() => setDonando(false)}
            ciudadId={ciudad.id}
            ciudadNombre={ciudad.nombre}
          />
          <ApuntarseVoluntario
            abierto={voluntario}
            alCerrar={() => setVoluntario(false)}
            ciudadId={ciudad.id}
            ciudadNombre={ciudad.nombre}
            alPedirAcceso={() => {
              setVoluntario(false)
              setAccesoAbierto(true)
            }}
          />
          <ApuntarVehiculo
            abierto={vehiculo}
            alCerrar={() => setVehiculo(false)}
            ciudadId={ciudad.id}
            ciudadNombre={ciudad.nombre}
            alPedirAcceso={() => {
              setVehiculo(false)
              setAccesoAbierto(true)
            }}
          />
          <Acceso abierto={accesoAbierto} alCerrar={() => setAccesoAbierto(false)} />
        </>
      )}
    </>
  )
}
