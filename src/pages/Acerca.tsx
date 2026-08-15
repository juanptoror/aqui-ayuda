import { CircleCheck, Database, Info, Lock, TriangleAlert } from 'lucide-react'
import { PageHeader, SectionHead, Notice, SkeletonLinea } from '@/components/ui'
import { useCentros, useCiudades, useInventario, useNecesidades } from '@/data/queries'
import { useSesion } from '@/state/sesion'
import { conteo } from '@/lib/format'

/**
 * Estado del sistema en vivo. No es decoración: si una tabla deja de responder,
 * esta página dice cuál y por qué, en vez de dejar la app "rara sin motivo".
 */
export function Acerca() {
  const { sesion } = useSesion()
  const ciudades = useCiudades()
  const centros = useCentros(!!sesion)
  const necesidades = useNecesidades()
  const inventario = useInventario()

  const fuentes = [
    { nombre: 'ciudades', q: ciudades, descripcion: 'Municipios del directorio' },
    { nombre: 'centros', q: centros, descripcion: 'Centros de acopio activos' },
    { nombre: 'necesidades', q: necesidades, descripcion: 'Pedidos abiertos y cubiertos' },
    { nombre: 'inventario', q: inventario, descripcion: 'Existencias reportadas' },
  ]

  const bloqueadas = fuentes.filter((f) => f.q.error)

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Info size={13} strokeWidth={2.6} />
            Acerca del proyecto
          </>
        }
        titulo="Ayudas Colombia"
        subtitulo="Directorio abierto de centros de acopio. Sin registro obligatorio y sin publicidad: entras, ves qué falta cerca de ti y actúas."
      />

      <div className="container">
        {bloqueadas.length > 0 && (
          <div className="stack">
            <Notice tono="critical">
              <strong>
                {conteo(bloqueadas.length, 'fuente de datos con error', 'fuentes de datos con error')}
                .
              </strong>{' '}
              La app sigue funcionando con lo que puede leer.
            </Notice>
          </div>
        )}

        <section className="section" style={{ marginTop: 'var(--sp-6)' }}>
          <SectionHead titulo="Estado de las fuentes de datos" />
          <div className="panel">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {fuentes.map((f, i) => {
                const error = f.q.error as Error | null
                const cargando = f.q.isLoading
                const total = Array.isArray(f.q.data) ? f.q.data.length : 0

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
                      ) : (
                        `${total} filas`
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        <section className="section">
          <SectionHead titulo="Por qué hay que entrar para ver los teléfonos" />
          <div className="panel">
            <div className="panel__body stack">
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Los permisos de <code>public.centros</code> están concedidos <strong>por columna</strong>,
                no sobre la tabla entera. El rol público puede leer nombre, dirección, responsable,
                notas, coordenadas, foto y si está abierto. La columna <code>telefono</code> está
                reservada a sesiones iniciadas, para que los números de contacto de los voluntarios
                no queden expuestos a cualquier rastreador.
              </p>
              <div className="notice notice--info">
                <Lock size={17} strokeWidth={2.25} />
                <div className="notice__text">
                  Consecuencia práctica para quien programe sobre esta base:{' '}
                  <code>select('*')</code> devuelve <code>42501 permission denied</code> aunque la
                  lista explícita de columnas permitidas devuelva 200. Hay que pedir columnas
                  concretas, y añadir <code>telefono</code> solo cuando hay sesión.
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                El acceso es por código de un solo uso enviado al correo: no hay contraseña que
                recordar ni que perder.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <SectionHead titulo="Cómo se usan tus datos" />
          <div className="panel">
            <div className="panel__body stack">
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                La ubicación se usa solo en tu dispositivo para calcular distancias y ordenar la
                lista. No se envía a ningún servidor ni se comparte con terceros.
              </p>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                El municipio que eliges se guarda en tu navegador para no volver a preguntártelo. No
                hay cookies de seguimiento ni analítica.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
