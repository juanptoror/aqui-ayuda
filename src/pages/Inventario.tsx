import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Boxes,
  Building2,
  ChevronRight,
  CircleSlash,
  Plus,
  Truck,
  TriangleAlert,
} from 'lucide-react'
import {
  PageHeader,
  SectionHead,
  EmptyState,
  AvisoError,
  Badge,
  SkeletonLinea,
} from '@/components/ui'
import { SelectorCiudad } from '@/components/SelectorCiudad'
import { FuentesDeLaPantalla } from '@/components/Fuente'
import { Acceso } from '@/components/Acceso'
import { ProgramarTransporte } from '@/components/formularios/ProgramarTransporte'
import { usePreferencias } from '@/state/preferencias'
import { useInventarioCiudad, useTransportesCiudad } from '@/datos/useInventarioCiudad'
import { useInventario, useTransporteItems } from '@/datos/consultas'
import { conteo, desde, numero } from '@/lib/format'
import type { ResumenCategoria, TransporteItem } from '@/dominio/modelos'

/**
 * Qué hay en el municipio, dónde está y qué se está moviendo.
 *
 * Responde la pregunta que la app no podía contestar: "hay agua, ¿pero dónde?".
 * Y pone al lado quién la está pidiendo, porque el problema de coordinación no
 * es la falta absoluta sino que algo sobre en un centro y falte en el de al
 * lado.
 */
export function Inventario() {
  const { ciudadGuardada } = usePreferencias()
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [accesoAbierto, setAccesoAbierto] = useState(false)
  const [transporteAbierto, setTransporteAbierto] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)

  const datos = useInventarioCiudad(ciudadGuardada ?? undefined)
  const { transportes, cargando: cargandoTransportes } = useTransportesCiudad(datos.ciudad?.id)
  const qInventario = useInventario()
  const qItems = useTransporteItems()

  /* Se agrupa una vez para todos los viajes: recorrer la lista completa dentro
     del render de cada fila sería cuadrático sin ninguna necesidad. */
  const porTransporte = useMemo(() => {
    const m = new Map<string, TransporteItem[]>()
    for (const it of qItems.data ?? []) {
      const lista = m.get(it.transporteId)
      if (lista) lista.push(it)
      else m.set(it.transporteId, [it])
    }
    return m
  }, [qItems.data])

  if (!ciudadGuardada) {
    return (
      <>
        <PageHeader
          eyebrow={
            <>
              <Boxes size={13} strokeWidth={2.6} />
              Existencias
            </>
          }
          titulo="Qué hay y dónde está"
          subtitulo="Elige un municipio y verás lo que tienen sus centros, quién lo está pidiendo y qué se está moviendo."
        />
        <div className="container">


          <EmptyState
            icono={Building2}
            titulo="Primero elige un municipio"
            texto="El inventario es de cada municipio. Dinos cuál te interesa."
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

  const { ciudad, resumen, cargando, centros } = datos
  const activos = transportes.filter((t) => t.estado === 'programado' || t.estado === 'en_ruta')
  /* Los entregados también se muestran. No es relleno: saber qué llegó ya —y
     con qué desglose— evita mandar dos veces lo mismo al mismo sitio. Los
     cancelados no aparecen: un viaje que no ocurrió no informa de nada. */
  const entregados = transportes.filter((t) => t.estado === 'entregado').slice(0, 5)
  const viajes = [...activos, ...entregados]

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Boxes size={13} strokeWidth={2.6} />
            {ciudad?.departamento ?? 'Colombia'}
          </>
        }
        titulo={`Qué hay en ${ciudad?.nombre ?? 'tu municipio'}`}
        subtitulo={
          cargando
            ? 'Consultando existencias…'
            : `${conteo(resumen.length, 'categoría', 'categorías')} entre existencias y pedidos, en ${conteo(centros.length, 'centro', 'centros')}.`
        }
        acciones={
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setTransporteAbierto(true)}
            >
              <Plus size={18} />
              <span>Nuevo transporte</span>
            </button>
            <button type="button" className="btn" onClick={() => setSelectorAbierto(true)}>
              <Building2 size={18} />
              <span>
                Cambiar<span className="oculto-movil"> municipio</span>
              </span>
            </button>
          </>
        }
      />

      <div className="container">
        <FuentesDeLaPantalla
          origenes={['ayudas-pereira']}
          nota="Solo los centros de acopio llevan inventario: las otras fuentes publican personas, no bodegas."
        />
        {datos.error ? (
          <div className="stack">
            <AvisoError error={datos.error} origen="AP" />
          </div>
        ) : null}

        {/* ----------------------------- TRANSPORTES ---------------------------- */}
        <section className="section" style={{ marginTop: 0 }}>
          <SectionHead
            titulo="Se está moviendo"
            conteo={
              cargandoTransportes
                ? undefined
                : activos.length > 0
                  ? conteo(activos.length, 'viaje en curso', 'viajes en curso')
                  : conteo(entregados.length, 'ya entregado', 'ya entregados')
            }
          />
          {cargandoTransportes ? (
            <div className="panel">
              <div className="panel__body stack">
                <SkeletonLinea alto={40} />
                <SkeletonLinea alto={40} />
              </div>
            </div>
          ) : viajes.length === 0 ? (
            <EmptyState
              icono={Truck}
              titulo="No hay nada en ruta ahora mismo"
              texto="Cuando alguien programe un viaje entre centros, aparecerá aquí con lo que lleva y quién lo conduce."
              acciones={
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setTransporteAbierto(true)}
                >
                  <span>Programar un transporte</span>
                </button>
              }
            />
          ) : (
            <div className="panel">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {viajes.map((t, i) => (
                  <li
                    key={t.id}
                    style={{
                      padding: 'var(--sp-4) var(--sp-5)',
                      borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                      minWidth: 0,
                    }}
                  >
                    <div className="row row--wrap" style={{ marginBottom: 'var(--sp-2)' }}>
                      <Badge
                        tono={
                          t.estado === 'en_ruta'
                            ? 'success'
                            : t.estado === 'entregado'
                              ? 'neutral'
                              : 'warning'
                        }
                      >
                        {t.estado === 'en_ruta'
                          ? 'En ruta'
                          : t.estado === 'entregado'
                            ? 'Entregado'
                            : 'Programado'}
                      </Badge>
                      <span className="min0 truncate" style={{ fontWeight: 650, flex: '1 1 auto' }}>
                        {t.carga ?? 'Carga sin detallar'}
                      </span>
                      <span
                        style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)' }}
                        className="num"
                      >
                        {t.salida ? desde(t.salida) : desde(t.creadoEn)}
                      </span>
                    </div>
                    <div
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: 'var(--text-sm)',
                        overflowWrap: 'break-word',
                      }}
                    >
                      {t.origenNombre} → {t.destinoNombre}
                      {t.vehiculo ? ` · ${t.vehiculo}` : ''}
                      {t.conductor ? ` · ${t.conductor}` : ''}
                    </div>

                    {/* El desglose real: `carga` es texto libre y no dice si lo
                        que viaja es lo que hace falta al otro lado. Esto sí. */}
                    {(porTransporte.get(t.id) ?? []).length > 0 && (
                      <div className="chips" style={{ marginTop: 'var(--sp-3)' }}>
                        {(porTransporte.get(t.id) ?? []).map((it) => (
                          <span
                            key={it.id}
                            className="badge badge--neutral"
                            style={{ textTransform: 'none' }}
                          >
                            {it.categoria}
                            {it.cantidad > 0 && (
                              <>
                                {' · '}
                                <span className="num">{it.cantidad}</span>
                                {it.unidad ? ` ${it.unidad}` : ''}
                              </>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ------------------------------ INVENTARIO ---------------------------- */}
        <section className="section">
          <SectionHead titulo="Categoría por categoría" />
          <p className="section__desc">
            Toca una categoría para ver en qué centro está y quién la está pidiendo.
          </p>

          {cargando ? (
            <div className="panel">
              <div className="panel__body stack">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonLinea key={i} alto={38} />
                ))}
              </div>
            </div>
          ) : resumen.length === 0 ? (
            <EmptyState
              icono={Boxes}
              titulo="Todavía no hay nada registrado"
              texto={`Ningún centro de ${ciudad?.nombre ?? 'este municipio'} ha reportado existencias ni pedidos.`}
              acciones={
                <Link className="btn btn--primary" to={`/ciudad/${ciudadGuardada}`}>
                  <span>Ver los centros</span>
                </Link>
              }
            />
          ) : (
            <div className="panel">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {resumen.map((c, i) => (
                  <FilaCategoria
                    key={c.categoria}
                    datos={c}
                    primera={i === 0}
                    abierta={abierta === c.categoria}
                    alAlternar={() =>
                      setAbierta((actual) => (actual === c.categoria ? null : c.categoria))
                    }
                  />
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <SelectorCiudad abierto={selectorAbierto} alCerrar={() => setSelectorAbierto(false)} />
      {ciudad && (
        <>
          <ProgramarTransporte
            abierto={transporteAbierto}
            alCerrar={() => setTransporteAbierto(false)}
            ciudadId={ciudad.id}
            centros={centros}
            inventario={qInventario.data ?? []}
            alPedirAcceso={() => {
              setTransporteAbierto(false)
              setAccesoAbierto(true)
            }}
          />
          <Acceso abierto={accesoAbierto} alCerrar={() => setAccesoAbierto(false)} />
        </>
      )}
    </>
  )
}

/** Fila plegable: resumen visible, detalle al abrir. */
function FilaCategoria({
  datos,
  primera,
  abierta,
  alAlternar,
}: {
  datos: ResumenCategoria
  primera: boolean
  abierta: boolean
  alAlternar: () => void
}) {
  const faltan = datos.solicitadaEn.length
  const hay = datos.disponibleEn.length

  return (
    <li style={{ borderTop: primera ? 'none' : '1px solid var(--border)', minWidth: 0 }}>
      <button
        type="button"
        onClick={alAlternar}
        aria-expanded={abierta}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-3)',
          width: '100%',
          padding: 'var(--sp-4) var(--sp-5)',
          textAlign: 'left',
          minWidth: 0,
        }}
      >
        <span className="min0 truncate" style={{ flex: '1 1 auto', fontWeight: 650 }}>
          {datos.categoria}
        </span>

        {faltan > 0 && (
          <Badge tono="critical">{conteo(faltan, 'lo pide', 'lo piden')}</Badge>
        )}
        {hay > 0 ? (
          <Badge tono="success">{conteo(hay, 'centro tiene', 'centros tienen')}</Badge>
        ) : (
          <Badge tono="neutral" icono={CircleSlash}>
            Sin existencias
          </Badge>
        )}

        <ChevronRight
          size={17}
          style={{
            flexShrink: 0,
            color: 'var(--text-subtle)',
            transform: abierta ? 'rotate(90deg)' : 'none',
            transition: 'transform var(--dur) var(--ease)',
          }}
        />
      </button>

      {abierta && (
        <div style={{ padding: '0 var(--sp-5) var(--sp-5)' }}>
          <div className="grid grid--halves grid--top">
            <div className="panel panel--inset">
              <div className="panel__body">
                <div className="deflist__label" style={{ marginBottom: 'var(--sp-3)' }}>
                  Dónde está
                </div>
                {datos.disponibleEn.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    Ningún centro tiene existencias registradas de esto.
                  </p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--sp-3)' }}>
                    {datos.disponibleEn.map((d) => (
                      <li key={d.centroId + d.unidad} className="row" style={{ alignItems: 'flex-start' }}>
                        <div className="min0" style={{ flex: '1 1 auto' }}>
                          <Link to={`/centro/${encodeURIComponent(d.centroId)}`}>
                            {d.centroNombre}
                          </Link>
                          {!d.centroAbierto && (
                            <span
                              style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}
                            >
                              {' '}
                              · cerrado
                            </span>
                          )}
                        </div>
                        <span className="num" style={{ fontWeight: 700, flexShrink: 0 }}>
                          {numero(d.cantidad)} {d.unidad}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="panel panel--inset">
              <div className="panel__body">
                <div className="deflist__label" style={{ marginBottom: 'var(--sp-3)' }}>
                  Quién lo pide
                </div>
                {datos.solicitadaEn.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    Nadie lo está pidiendo ahora mismo.
                  </p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--sp-3)' }}>
                    {datos.solicitadaEn.map((s, i) => (
                      <li key={s.centroId + i} style={{ minWidth: 0 }}>
                        <div className="row" style={{ alignItems: 'flex-start' }}>
                          <span style={{ flexShrink: 0, marginTop: 2 }}>
                            {s.prioridad === 'urgente' ? (
                              <Badge tono="critical" icono={TriangleAlert}>
                                Urgente
                              </Badge>
                            ) : s.prioridad === 'alta' ? (
                              <Badge tono="warning">Alta</Badge>
                            ) : (
                              <Badge tono="neutral">Normal</Badge>
                            )}
                          </span>
                          <div className="min0" style={{ flex: '1 1 auto' }}>
                            <Link to={`/centro/${encodeURIComponent(s.centroId)}`}>
                              {s.centroNombre}
                            </Link>
                            {s.descripcion && (
                              <div
                                style={{
                                  color: 'var(--text-muted)',
                                  fontSize: 'var(--text-sm)',
                                  overflowWrap: 'break-word',
                                }}
                              >
                                {s.descripcion}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}
