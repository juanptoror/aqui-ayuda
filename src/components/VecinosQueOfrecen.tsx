import { useMemo, useState } from 'react'
import { MessageCircle, Phone, Users } from 'lucide-react'
import { SectionHead, EmptyState, Badge, SkeletonLinea, Notice } from './ui'
import { SelloFuente } from './Fuente'
import { useOfrecimientosPersona } from '@/datos/consultas'
import { conteo } from '@/lib/format'

/**
 * Vecinos que se ofrecen a ayudar, con su teléfono.
 *
 * Resuelve el callejón sin salida de esta pantalla: los voluntarios de Ayudas
 * Pereira no se pueden contactar —el teléfono está denegado al rol público y
 * solo lo ve quien coordina desde su cuenta—, así que ver una lista de nombres
 * no servía para nada.
 *
 * El tablón de Pereira Unida sí publica el teléfono: es parte del dato, no algo
 * que nosotros desbloqueemos. Aquí se muestra exactamente lo que ya está
 * publicado allí, ni un campo más, y con el sello de quién lo publicó.
 */

/** Etiquetas de la fuente, en palabras normales. */
const HABILIDADES: Record<string, string> = {
  alimentacion: 'Comida',
  psicologia: 'Apoyo psicológico',
  transporte: 'Transporte',
  rescate: 'Rescate',
  medico: 'Atención médica',
  enfermeria: 'Enfermería',
  oficios: 'Oficios varios',
  legal: 'Asesoría legal',
  ingenieria: 'Ingeniería',
  otro: 'Otras formas de ayudar',
}

function bonita(h: string): string {
  return HABILIDADES[h] ?? h.replace(/_/g, ' ')
}

/** Un móvil colombiano son 10 dígitos que empiezan por 3. */
function whatsapp(telefono: string | null): string | null {
  if (!telefono) return null
  const digitos = telefono.replace(/\D/g, '')
  if (digitos.length < 10) return null
  const con57 = digitos.startsWith('57') ? digitos : `57${digitos}`
  return `https://wa.me/${con57}?text=${encodeURIComponent(
    'Hola, vi tu ofrecimiento de ayuda en AquíAyuda. ¿Sigues disponible?',
  )}`
}

const TOPE = 12

export function VecinosQueOfrecen({ municipio }: { municipio: string | null }) {
  const q = useOfrecimientosPersona()
  const [verTodos, setVerTodos] = useState(false)
  const [filtro, setFiltro] = useState<string | null>(null)

  /* El municipio llega como texto, no como identificador: esta fuente no tiene
     catálogo de ciudades y guarda "Pereira" tal cual lo escribió la persona. */
  const delMunicipio = useMemo(() => {
    const todos = q.data ?? []
    if (!municipio) return todos
    const clave = municipio.toLowerCase().trim()
    return todos.filter((o) => (o.municipio ?? '').toLowerCase().trim() === clave)
  }, [q.data, municipio])

  const porHabilidad = useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const o of delMunicipio) cuenta.set(o.habilidad, (cuenta.get(o.habilidad) ?? 0) + 1)
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1])
  }, [delMunicipio])

  const filtrados = filtro ? delMunicipio.filter((o) => o.habilidad === filtro) : delMunicipio
  const visibles = verTodos ? filtrados : filtrados.slice(0, TOPE)
  const conTelefono = filtrados.filter((o) => whatsapp(o.telefono)).length

  if (q.isError) return null

  return (
    <section className="section">
      <SectionHead
        titulo="Vecinos a los que puedes escribir"
        conteo={q.isLoading ? undefined : conteo(delMunicipio.length, 'persona', 'personas')}
        acciones={<SelloFuente origen="pereira-unida" />}
      />

      {q.isLoading ? (
        <div className="grid grid--cards">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="panel" style={{ padding: 'var(--sp-5)' }}>
              <SkeletonLinea ancho="55%" alto={20} />
              <div style={{ height: 10 }} />
              <SkeletonLinea ancho="80%" />
            </div>
          ))}
        </div>
      ) : delMunicipio.length === 0 ? (
        <EmptyState
          icono={Users}
          titulo="Nadie se ha ofrecido aquí todavía"
          texto="Este tablón lo llena la propia comunidad. En Pereira y Dosquebradas hay bastantes personas apuntadas."
        />
      ) : (
        <>
          <Notice tono="info" icono={MessageCircle}>
            Estos teléfonos <strong>ya son públicos</strong> en el tablón de Pereira Unida: cada
            persona los dejó ahí para que la llamaran. Escribe solo para coordinar ayuda.
          </Notice>

          {porHabilidad.length > 1 && (
            <div className="chips" style={{ margin: 'var(--sp-4) 0' }}>
              <button
                type="button"
                className="chip"
                aria-pressed={filtro === null}
                onClick={() => setFiltro(null)}
              >
                <span>Todo</span>
              </button>
              {porHabilidad.map(([h, n]) => (
                <button
                  key={h}
                  type="button"
                  className="chip"
                  aria-pressed={filtro === h}
                  onClick={() => setFiltro(filtro === h ? null : h)}
                >
                  <span>{bonita(h)}</span>
                  <span className="num" style={{ fontWeight: 800 }}>
                    {n}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid--cards">
            {visibles.map((o) => {
              const wa = whatsapp(o.telefono)
              return (
                <article key={o.id} className="card">
                  <div className="card__body">
                    <div className="row row--wrap">
                      <Badge tono="success">{bonita(o.habilidad)}</Badge>
                    </div>
                    <h3 className="card__title">{o.nombre}</h3>
                    {o.descripcion && (
                      <p className="clamp-3" style={{ color: 'var(--text-muted)', margin: 0 }}>
                        {o.descripcion}
                      </p>
                    )}
                    {o.municipio && (
                      <div style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
                        {o.municipio}
                        {o.departamento ? ` · ${o.departamento}` : ''}
                      </div>
                    )}
                  </div>
                  <div className="card__footer">
                    {wa ? (
                      <a
                        className="btn btn--sm btn--primary"
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle size={15} />
                        <span>WhatsApp</span>
                      </a>
                    ) : o.telefono ? (
                      <a className="btn btn--sm" href={`tel:${o.telefono.replace(/\D/g, '')}`}>
                        <Phone size={15} />
                        <span>{o.telefono}</span>
                      </a>
                    ) : (
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)' }}>
                        Sin teléfono publicado
                      </span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          {!verTodos && filtrados.length > TOPE && (
            <div className="row" style={{ marginTop: 'var(--sp-4)' }}>
              <button type="button" className="btn" onClick={() => setVerTodos(true)}>
                <span>Ver {conteo(filtrados.length, 'persona', 'personas')}</span>
              </button>
            </div>
          )}

          {conTelefono < filtrados.length && (
            <p
              style={{
                marginTop: 'var(--sp-3)',
                color: 'var(--text-subtle)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {filtrados.length - conTelefono} de estas personas no dejaron un número con el que se
              pueda escribir.
            </p>
          )}
        </>
      )}
    </section>
  )
}
