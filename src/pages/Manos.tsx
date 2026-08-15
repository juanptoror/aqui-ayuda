import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, HandHeart, Truck, Users } from 'lucide-react'
import {
  PageHeader,
  SectionHead,
  EmptyState,
  AvisoError,
  Badge,
  SkeletonLinea,
} from '@/components/ui'
import { SelectorCiudad } from '@/components/SelectorCiudad'
import { Acceso } from '@/components/Acceso'
import { ApuntarseVoluntario } from '@/components/formularios/ApuntarseVoluntario'
import { ApuntarVehiculo } from '@/components/formularios/ApuntarVehiculo'
import { usePreferencias } from '@/state/preferencias'
import { useMunicipios, useVehiculos, useVoluntarios } from '@/datos/consultas'
import { conteo } from '@/lib/format'

/**
 * Quién puede ayudar: personas y vehículos apuntados en el municipio.
 *
 * Cierra el ciclo de dos formularios que hasta ahora escribían a ciegas: uno se
 * apuntaba y no volvía a saber nada. Aquí se ve la lista, y quien coordina sabe
 * con cuántas manos cuenta antes de pedir refuerzos fuera.
 *
 * Los teléfonos no aparecen: el backend los reserva a sesiones iniciadas, y esta
 * pantalla es pública.
 */
export function Manos() {
  const { ciudadGuardada } = usePreferencias()
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [accesoAbierto, setAccesoAbierto] = useState(false)
  const [voluntarioAbierto, setVoluntarioAbierto] = useState(false)
  const [vehiculoAbierto, setVehiculoAbierto] = useState(false)
  const [verTodos, setVerTodos] = useState(false)
  const [verTodosVehiculos, setVerTodosVehiculos] = useState(false)

  const qCiudades = useMunicipios()
  const qVoluntarios = useVoluntarios()
  const qVehiculos = useVehiculos()

  const ciudad = useMemo(
    () => (qCiudades.data ?? []).find((c) => c.slug === ciudadGuardada) ?? null,
    [qCiudades.data, ciudadGuardada],
  )

  const voluntarios = useMemo(
    () =>
      (qVoluntarios.data ?? [])
        .filter((v) => v.disponible && (!ciudad || v.ciudadId === ciudad.id))
        .sort((a, b) => b.puedeAyudarEn.length - a.puedeAyudarEn.length),
    [qVoluntarios.data, ciudad],
  )

  const vehiculos = useMemo(
    () => (qVehiculos.data ?? []).filter((v) => v.disponible && (!ciudad || v.ciudadId === ciudad.id)),
    [qVehiculos.data, ciudad],
  )

  /* Hay 164 personas apuntadas solo en Dosquebradas. Volcarlas todas de golpe
     no es una pantalla, es un listado: a 375 px medía 11.794 px, treinta
     pantallas de scroll. El resumen por tarea de arriba responde la pregunta
     real —"¿tengo gente para cargar?"— y quien necesite la lista la despliega. */
  const TOPE = 9
  const visibles = verTodos ? voluntarios : voluntarios.slice(0, TOPE)
  const vehiculosVisibles = verTodosVehiculos ? vehiculos : vehiculos.slice(0, TOPE)

  /** Cuántas personas hay por tarea: dice dónde falta gente, no solo cuánta hay. */
  const porTarea = useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const v of voluntarios) {
      for (const t of v.puedeAyudarEn) cuenta.set(t, (cuenta.get(t) ?? 0) + 1)
    }
    return [...cuenta.entries()].map(([tarea, total]) => ({ tarea, total })).sort((a, b) => b.total - a.total)
  }, [voluntarios])

  if (!ciudadGuardada) {
    return (
      <>
        <PageHeader
          eyebrow={
            <>
              <Users size={13} strokeWidth={2.6} />
              Manos y vehículos
            </>
          }
          titulo="Quién puede ayudar"
          subtitulo="Elige un municipio y verás quién se ha apuntado a echar una mano y qué vehículos hay disponibles."
        />
        <div className="container">
          <EmptyState
            icono={Building2}
            titulo="Primero elige un municipio"
            texto="La lista es de cada municipio, porque las manos ayudan donde están."
            acciones={
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setSelectorAbierto(true)}
              >
                <span>Elegir municipio</span>
              </button>
            }
          />
        </div>
        <SelectorCiudad abierto={selectorAbierto} alCerrar={() => setSelectorAbierto(false)} />
      </>
    )
  }

  const cargando = qVoluntarios.isLoading || qVehiculos.isLoading
  const error = qVoluntarios.error ?? qVehiculos.error

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Users size={13} strokeWidth={2.6} />
            {ciudad?.departamento ?? 'Colombia'}
          </>
        }
        titulo={`Quién puede ayudar en ${ciudad?.nombre ?? 'tu municipio'}`}
        subtitulo={
          cargando
            ? 'Consultando quién se ha apuntado…'
            : `${conteo(voluntarios.length, 'persona apuntada', 'personas apuntadas')} y ${conteo(vehiculos.length, 'vehículo disponible', 'vehículos disponibles')}.`
        }
        acciones={
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setVoluntarioAbierto(true)}
            >
              <HandHeart size={18} />
              <span>Apuntarme</span>
            </button>
            <button type="button" className="btn" onClick={() => setVehiculoAbierto(true)}>
              <Truck size={18} />
              <span>Poner mi carro</span>
            </button>
          </>
        }
      />

      <div className="container">
        {error ? (
          <div className="stack">
            <AvisoError error={error} origen="AP" />
          </div>
        ) : null}

        {porTarea.length > 0 && (
          <section className="section" style={{ marginTop: 0 }}>
            <SectionHead titulo="Manos por tarea" />
            <div className="chips">
              {porTarea.map((t) => (
                <span key={t.tarea} className="chip" style={{ cursor: 'default' }}>
                  <span>{t.tarea}</span>
                  <span className="num" style={{ fontWeight: 800 }}>
                    {t.total}
                  </span>
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <SectionHead
            titulo="Personas"
            conteo={cargando ? undefined : conteo(voluntarios.length, 'apuntada', 'apuntadas')}
          />
          {cargando ? (
            <div className="grid grid--cards">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="panel" style={{ padding: 'var(--sp-5)' }}>
                  <SkeletonLinea ancho="55%" alto={20} />
                  <div style={{ height: 10 }} />
                  <SkeletonLinea ancho="80%" />
                </div>
              ))}
            </div>
          ) : voluntarios.length === 0 ? (
            <EmptyState
              icono={HandHeart}
              titulo="Todavía no hay nadie apuntado aquí"
              texto="Si puedes echar una mano —clasificar, cargar, cocinar, atender— apúntate y los coordinadores te llaman cuando hagan falta manos."
              acciones={
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setVoluntarioAbierto(true)}
                >
                  <span>Apuntarme</span>
                </button>
              }
            />
          ) : (
            <div className="grid grid--cards">
              {visibles.map((v) => (
                <article key={v.id} className="card">
                  <div className="card__body">
                    <h3 className="card__title">{v.nombre}</h3>
                    {v.puedeAyudarEn.length > 0 && (
                      <div className="chips">
                        {v.puedeAyudarEn.map((t) => (
                          <span
                            key={t}
                            className="badge badge--neutral"
                            style={{ textTransform: 'none' }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {v.disponibilidad.length > 0 && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                        {v.disponibilidad.join(' · ')}
                      </div>
                    )}
                    {v.notas && (
                      <p className="clamp-2" style={{ color: 'var(--text-muted)', margin: 0 }}>
                        {v.notas}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {!verTodos && voluntarios.length > TOPE && (
            <div className="row" style={{ marginTop: 'var(--sp-4)' }}>
              <button type="button" className="btn" onClick={() => setVerTodos(true)}>
                <span>Ver las {voluntarios.length} personas</span>
              </button>
            </div>
          )}
        </section>

        <section className="section">
          <SectionHead
            titulo="Vehículos"
            conteo={cargando ? undefined : conteo(vehiculos.length, 'disponible', 'disponibles')}
          />
          {!cargando && vehiculos.length === 0 ? (
            <EmptyState
              icono={Truck}
              titulo="No hay vehículos apuntados"
              texto="El transporte suele ser el cuello de botella: hay donaciones paradas porque nadie puede moverlas."
              acciones={
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setVehiculoAbierto(true)}
                >
                  <span>Poner mi carro</span>
                </button>
              }
            />
          ) : (
            <div className="grid grid--cards">
              {vehiculosVisibles.map((v) => (
                <article key={v.id} className="card">
                  <div className="card__body">
                    <div className="row">
                      <Badge tono="success">Disponible</Badge>
                    </div>
                    <h3 className="card__title">{v.vehiculo}</h3>
                    <div style={{ color: 'var(--text-muted)' }}>{v.nombre}</div>
                    {v.capacidad && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                        Cabe: {v.capacidad}
                      </div>
                    )}
                    {v.zona && (
                      <div style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
                        Se mueve por {v.zona}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {!verTodosVehiculos && vehiculos.length > TOPE && (
            <div className="row" style={{ marginTop: 'var(--sp-4)' }}>
              <button type="button" className="btn" onClick={() => setVerTodosVehiculos(true)}>
                <span>Ver los {vehiculos.length} vehículos</span>
              </button>
            </div>
          )}
        </section>

        <section className="section">
          <p style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
            Los teléfonos no se muestran aquí: quedan reservados a quien coordina desde{' '}
            <Link to="/acerca">su cuenta</Link>.
          </p>
        </section>
      </div>

      <SelectorCiudad abierto={selectorAbierto} alCerrar={() => setSelectorAbierto(false)} />
      {ciudad && (
        <>
          <ApuntarseVoluntario
            abierto={voluntarioAbierto}
            alCerrar={() => setVoluntarioAbierto(false)}
            ciudadId={ciudad.id}
            ciudadNombre={ciudad.nombre}
            alPedirAcceso={() => {
              setVoluntarioAbierto(false)
              setAccesoAbierto(true)
            }}
          />
          <ApuntarVehiculo
            abierto={vehiculoAbierto}
            alCerrar={() => setVehiculoAbierto(false)}
            ciudadId={ciudad.id}
            ciudadNombre={ciudad.nombre}
            alPedirAcceso={() => {
              setVehiculoAbierto(false)
              setAccesoAbierto(true)
            }}
          />
          <Acceso abierto={accesoAbierto} alCerrar={() => setAccesoAbierto(false)} />
        </>
      )}
    </>
  )
}
