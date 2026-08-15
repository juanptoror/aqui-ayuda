import { Link } from 'react-router-dom'
import { Activity, CircleCheck, Database, Lock, TriangleAlert } from 'lucide-react'
import { PageHeader, SectionHead, Notice, SkeletonLinea } from '@/components/ui'
import { useCentros, useCiudades, useInventario, useNecesidades } from '@/data/queries'
import { useAyudas, useEmergencias } from '@/data/corag'
import { useSesion } from '@/state/sesion'
import { usePreferencias } from '@/state/preferencias'
import { conteo } from '@/lib/format'

/**
 * Estado del sistema en vivo. Aquí sí cabe el detalle técnico: si una fuente
 * deja de responder, esta página dice cuál y por qué, en vez de dejar la app
 * "rara sin motivo". La página "Acerca" se quedó con lo que le importa a
 * cualquiera; esto es para quien mantiene o audita el proyecto.
 */
export function Estado() {
  const { sesion } = useSesion()
  const { ubicacion } = usePreferencias()

  const ciudades = useCiudades()
  const centros = useCentros(!!sesion)
  const necesidades = useNecesidades()
  const inventario = useInventario()
  const emergencias = useEmergencias()
  const ayudas = useAyudas({ tipo: 'request', ubicacion, radioKm: 150, limite: 1 })

  /* Cada consulta devuelve un tipo distinto; aquí solo interesan tres cosas de
     todas ellas, así que se tipan al mínimo común en vez de forzar uniones. */
  interface FilaEstado {
    nombre: string
    descripcion: string
    q: { isLoading: boolean; error: unknown; data: unknown }
  }

  const fuentes: { grupo: string; filas: FilaEstado[] }[] = [
    {
      grupo: 'Ayudas Pereira · Supabase',
      filas: [
        { nombre: 'ciudades', q: ciudades, descripcion: 'Municipios del directorio' },
        { nombre: 'centros', q: centros, descripcion: 'Centros de acopio activos' },
        { nombre: 'necesidades', q: necesidades, descripcion: 'Pedidos abiertos y cubiertos' },
        { nombre: 'inventario', q: inventario, descripcion: 'Existencias reportadas' },
      ],
    },
    {
      grupo: 'Corag · API pública',
      filas: [
        { nombre: '/help', q: emergencias, descripcion: 'Emergencias activas' },
        { nombre: '/help?view=list', q: ayudas, descripcion: 'Solicitudes y ofrecimientos' },
      ],
    },
  ]

  const conError = fuentes.flatMap((g) => g.filas).filter((f) => f.q.error)

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Activity size={13} strokeWidth={2.6} />
            Diagnóstico
          </>
        }
        titulo="Estado del sistema"
        subtitulo="Qué fuente responde y cuál no, en vivo. Si algo de la app se ve raro, la explicación suele estar aquí."
        acciones={
          <Link className="btn" to="/acerca">
            <span>Acerca del proyecto</span>
          </Link>
        }
        estrecho
      />

      <div className="container container--narrow">
        {conError.length > 0 && (
          <div className="stack">
            <Notice tono="critical">
              <strong>
                {conteo(conError.length, 'fuente con error', 'fuentes con error')}.
              </strong>{' '}
              La app sigue funcionando con lo que puede leer.
            </Notice>
          </div>
        )}

        {fuentes.map((grupo) => (
          <section className="section" key={grupo.grupo}>
            <SectionHead titulo={grupo.grupo} />
            <div className="panel">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {grupo.filas.map((f, i) => {
                  const error = f.q.error as Error | null
                  const cargando = f.q.isLoading
                  const datos = f.q.data as unknown
                  const total = Array.isArray(datos)
                    ? datos.length
                    : datos && typeof datos === 'object' && 'total' in datos
                      ? (datos as { total: number }).total
                      : null

                  return (
                    <li
                      key={f.nombre}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--sp-3)',
                        padding: 'var(--sp-4) var(--sp-5)',
                        borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                        minWidth: 0,
                      }}
                    >
                      <span style={{ flexShrink: 0, marginTop: 2 }}>
                        {cargando ? (
                          <Database size={18} style={{ color: 'var(--text-subtle)' }} />
                        ) : error ? (
                          <TriangleAlert size={18} style={{ color: 'var(--critical)' }} />
                        ) : (
                          <CircleCheck size={18} style={{ color: 'var(--success)' }} />
                        )}
                      </span>
                      <div className="min0" style={{ flex: '1 1 auto' }}>
                        <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                          {f.nombre}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                          {f.descripcion}
                        </div>
                        {error && (
                          <div
                            style={{
                              color: 'var(--critical)',
                              fontSize: 'var(--text-sm)',
                              marginTop: 4,
                              overflowWrap: 'break-word',
                            }}
                          >
                            {error.message}
                          </div>
                        )}
                      </div>
                      <span
                        className="num"
                        style={{ flexShrink: 0, fontWeight: 700, color: 'var(--text-muted)' }}
                      >
                        {cargando ? (
                          <SkeletonLinea ancho="52px" alto={16} />
                        ) : error ? (
                          'sin acceso'
                        ) : total != null ? (
                          `${total} filas`
                        ) : (
                          'ok'
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>
        ))}

        <section className="section">
          <SectionHead titulo="Por qué hay que entrar para ver los teléfonos" />
          <div className="panel">
            <div className="panel__body stack">
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Los permisos de <code>public.centros</code> están concedidos{' '}
                <strong>por columna</strong>, no sobre la tabla entera. El rol público puede leer
                nombre, dirección, responsable, notas, coordenadas, foto y si está abierto. La
                columna <code>telefono</code> está reservada a sesiones iniciadas, para que los
                números de contacto no queden expuestos a cualquier rastreador.
              </p>
              <div className="notice notice--info">
                <Lock size={17} strokeWidth={2.25} />
                <div className="notice__text">
                  Para quien programe sobre esta base: <code>select('*')</code> devuelve{' '}
                  <code>42501 permission denied</code> aunque la lista explícita de columnas
                  permitidas devuelva 200. Hay que pedir columnas concretas y añadir{' '}
                  <code>telefono</code> solo cuando hay sesión.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
