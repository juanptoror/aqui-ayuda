import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ChevronRight, Package, TriangleAlert } from 'lucide-react'
import {
  PageHeader,
  EmptyState,
  AvisoError,
  SectionHead,
  SkeletonLinea,
  Badge,
} from '@/components/ui'
import { SelectorCiudad } from '@/components/SelectorCiudad'
import { DetalleNecesidad } from '@/components/DetalleNecesidad'
import { FuentesDeLaPantalla } from '@/components/Fuente'
import { CambioDeVista, VISTAS_MUNICIPIO } from '@/components/CambioDeVista'
import { usePreferencias } from '@/state/preferencias'
import { useDatosCiudad } from '@/datos/useDatosCiudad'
import { conteo, desde, numero } from '@/lib/format'

/**
 * Vista de una sola pregunta: "¿qué falta aquí ahora?".
 * Pensada para quien va a comprar o mover cosas y necesita decidir rápido.
 */
export function QueFalta() {
  const { ubicacion, ciudadGuardada } = usePreferencias()
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [categoriaAbierta, setCategoriaAbierta] = useState<string | null>(null)
  const datos = useDatosCiudad(ciudadGuardada ?? undefined, ubicacion)

  if (!ciudadGuardada) {
    return (
      <>
        <PageHeader
          eyebrow={
            <>
              <TriangleAlert size={13} strokeWidth={2.6} />
              Prioridades
            </>
          }
          titulo="Qué falta ahora mismo"
          subtitulo="Elige un municipio y te mostramos lo que están pidiendo sus centros de acopio, ordenado por urgencia."
        />
        <div className="container">


          <EmptyState
            icono={Building2}
            titulo="Primero elige un municipio"
            texto="Las necesidades cambian mucho de un municipio a otro. Dinos cuál te interesa y verás solo lo que hace falta ahí."
            acciones={
              <>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setSelectorAbierto(true)}
                >
                  <span>Elegir municipio</span>
                </button>
                <Link className="btn" to="/ciudades">
                  <span>Ver el directorio</span>
                </Link>
              </>
            }
          />
        </div>
        <SelectorCiudad abierto={selectorAbierto} alCerrar={() => setSelectorAbierto(false)} />
      </>
    )
  }

  const { ciudad, categoriasUrgentes, resumen, cargando } = datos
  const totalPedidos = categoriasUrgentes.reduce((s, c) => s + c.total, 0)
  const maximo = categoriasUrgentes[0]?.total ?? 1

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <TriangleAlert size={13} strokeWidth={2.6} />
            {ciudad?.departamento ?? 'Colombia'}
          </>
        }
        titulo={`Qué falta en ${ciudad?.nombre ?? 'tu municipio'}`}
        subtitulo={
          cargando
            ? 'Consultando pedidos abiertos…'
            : `${conteo(totalPedidos, 'pedido urgente o alto', 'pedidos urgentes o altos')} en ${conteo(resumen.centros, 'centro', 'centros')} · actualizado ${desde(resumen.actualizado)}`
        }
        acciones={
          <>
            <button type="button" className="btn" onClick={() => setSelectorAbierto(true)}>
              <Building2 size={18} />
              <span>Cambiar municipio</span>
            </button>
            <Link className="btn btn--primary" to={`/ciudad/${ciudadGuardada}`}>
              <span>Ver centros</span>
              <ChevronRight size={17} />
            </Link>
          </>
        }
      />

      <div className="container">
        <FuentesDeLaPantalla
          origenes={['ayudas-pereira']}
          nota="Lo que piden los centros de acopio. Lo que piden las personas está en Ayuda entre personas."
        />

        <div className="section" style={{ marginTop: 0 }}>
          <CambioDeVista vistas={VISTAS_MUNICIPIO} />
        </div>
        {datos.error ? (
          <div className="stack">
            <AvisoError error={datos.error} origen="AP" />
          </div>
        ) : null}

        <section className="section">
          <SectionHead
            titulo="Prioridades del municipio"
            conteo={cargando ? undefined : conteo(categoriasUrgentes.length, 'categoría', 'categorías')}
          />

          {cargando ? (
            <div className="panel">
              <div className="panel__body stack">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonLinea key={i} alto={38} />
                ))}
              </div>
            </div>
          ) : categoriasUrgentes.length === 0 ? (
            <EmptyState
              icono={Package}
              titulo="No hay pedidos urgentes ahora"
              texto={`Los centros de ${ciudad?.nombre ?? 'este municipio'} tienen cubierto lo que necesitaban. Antes de llevar algo, revisa otro municipio o consulta el listado completo de centros.`}
              acciones={
                <>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => setSelectorAbierto(true)}
                  >
                    <span>Revisar otro municipio</span>
                  </button>
                  <Link className="btn" to={`/ciudad/${ciudadGuardada}`}>
                    <span>Ver todos los centros</span>
                  </Link>
                </>
              }
            />
          ) : (
            /* Lista de una sola columna: estirarla a 1240px hace que las barras
               atraviesen la pantalla y dominen la página sin aportar nada. */
            <div className="panel" style={{ maxWidth: 'var(--container-narrow)' }}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {categoriasUrgentes.map((c, i) => (
                  <li
                    key={c.categoria}
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    {/* Pulsable entera: la categoría sola no dice qué comprar
                        ni a dónde llevarlo, y esas dos cosas ya estaban
                        cargadas —solo faltaba abrirlas. */}
                    <button
                      type="button"
                      className="fila-pulsable"
                      onClick={() => setCategoriaAbierta(c.categoria)}
                      aria-label={`Ver qué centros piden ${c.categoria}`}
                    >
                    <div className="row" style={{ marginBottom: 'var(--sp-2)' }}>
                      <span
                        className="num"
                        style={{
                          flexShrink: 0,
                          width: 26,
                          fontWeight: 800,
                          color: 'var(--text-subtle)',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="min0 truncate" style={{ flex: '1 1 auto', fontWeight: 650 }}>
                        {c.categoria}
                      </span>
                      {i === 0 && <Badge tono="critical">Lo más pedido</Badge>}
                      <span
                        className="num"
                        style={{ flexShrink: 0, fontWeight: 700, color: 'var(--text-muted)' }}
                      >
                        {numero(c.total)}
                      </span>
                      <ChevronRight size={17} className="fila-pulsable__flecha" />
                    </div>
                    {/* Barra proporcional: se ve de un vistazo qué falta más. */}
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
                          width: `${Math.max(6, (c.total / maximo) * 100)}%`,
                          borderRadius: 'var(--r-full)',
                          background: i === 0 ? 'var(--critical-solid)' : 'var(--accion)',
                        }}
                      />
                    </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <SelectorCiudad abierto={selectorAbierto} alCerrar={() => setSelectorAbierto(false)} />
      <DetalleNecesidad
        categoria={categoriaAbierta}
        centros={datos.centros}
        alCerrar={() => setCategoriaAbierta(null)}
      />
    </>
  )
}
