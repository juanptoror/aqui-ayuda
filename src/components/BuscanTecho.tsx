import { MessageCircle, Search } from 'lucide-react'
import { SectionHead, EmptyState, Badge, Notice, SkeletonLinea } from './ui'
import { SelloFuente } from './Fuente'
import { ComoLlegar } from './ComoLlegar'
import { usePeticionesPersona } from '@/datos/consultas'
import { useAyudas, enlaceWhatsapp, LIMITE_MAX } from '@/backends/corag'
import { usePreferencias } from '@/state/preferencias'
import { conteo, desde } from '@/lib/format'

/**
 * Quién está buscando un techo.
 *
 * Es el hueco que dejaban las cuatro fuentes juntas: hay 112 arriendos
 * publicados y **cero ofertas de refugio** en Corag, mientras las peticiones de
 * alojamiento están tiradas en otras dos pantallas donde nadie con un piso
 * vacío va a mirar.
 *
 * Poner la demanda al lado de la oferta es el único punto de todo el rediseño
 * donde unir crea una función que antes no existía: quien entra a publicar un
 * apartamento ve, en la pestaña de al lado, a las familias que lo piden.
 */

/* Palabras con las que la gente pide techo cuando la fuente no tiene una
   categoría para ello. Pereira Unida etiqueta casi todo como `otros`, así que
   sin esto sus peticiones de vivienda serían invisibles aquí. */
const PALABRAS = /aloja|vivienda|arrend|arriend|alquil|casa|apartament|habitaci|refugio|albergue|techo|hosped|inquilin|pieza/i

export function BuscanTecho() {
  const { ubicacion } = usePreferencias()
  const qCorag = useAyudas({ tipo: 'request', ubicacion, radioKm: 150, limite: LIMITE_MAX })
  const qVecinos = usePeticionesPersona()

  const cargando = qCorag.isLoading || qVecinos.isLoading

  const deCorag = (qCorag.data?.items ?? []).filter(
    (a) => a.category === 'refugio' || PALABRAS.test(`${a.title} ${a.description ?? ''}`),
  )

  const deVecinos = (qVecinos.data ?? []).filter((v) =>
    PALABRAS.test(`${v.titulo} ${v.descripcion ?? ''}`),
  )

  const total = deCorag.length + deVecinos.length

  if (cargando) {
    return (
      <section className="section">
        <div className="panel">
          <div className="panel__body stack">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonLinea key={i} alto={44} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (total === 0) {
    return (
      <EmptyState
        icono={Search}
        titulo="Ahora mismo nadie pide alojamiento"
        texto="Es una buena noticia. Si tienes un sitio libre, publícalo igualmente: la oferta suele tardar más en llegar que la necesidad."
      />
    )
  }

  return (
    <section className="section">
      <SectionHead
        titulo="Familias buscando dónde vivir"
        conteo={conteo(total, 'petición', 'peticiones')}
      />

      <Notice tono="warning">
        Hay <strong>{conteo(total, 'familia pidiendo techo', 'familias pidiendo techo')}</strong> y
        ninguna oferta de alojamiento gratuito publicada. Si puedes alojar a alguien, aunque sea
        unos días, escríbeles directamente.
      </Notice>

      <div className="panel" style={{ marginTop: 'var(--sp-4)' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {deCorag.map((a, i) => {
            const wa = enlaceWhatsapp(a.contact?.whatsapp ?? null, a.title)
            return (
              <li key={a.id} style={{ padding: 'var(--sp-4) var(--sp-5)', borderTop: i === 0 ? 'none' : '1px solid var(--border)', minWidth: 0 }}>
                <div className="row row--wrap" style={{ marginBottom: 'var(--sp-2)' }}>
                  {a.urgency === 'urgent' && <Badge tono="critical">Urgente</Badge>}
                  <span className="min0" style={{ flex: '1 1 12rem', fontWeight: 650 }}>
                    {a.title}
                  </span>
                </div>
                {a.description && <p className="detalle-nota">{a.description}</p>}
                <div className="row row--wrap" style={{ marginTop: 'var(--sp-3)' }}>
                  <SelloFuente origen="corag" />
                  <span className="truncate min0" style={{ flex: '1 1 8rem', color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
                    {[a.location?.neighborhood, a.location?.address].filter(Boolean).join(' · ')}
                  </span>
                  <div className="spacer" />
                  <ComoLlegar
                    destino={{
                      lat: a.location?.latitude,
                      lng: a.location?.longitude,
                      direccion: a.location?.address,
                      zona: a.location?.neighborhood,
                    }}
                    variante="enlace"
                    modo="ver"
                  />
                  {wa && (
                    <a className="btn btn--sm btn--primary" href={wa} target="_blank" rel="noopener noreferrer">
                      <MessageCircle size={15} />
                      <span>Escribir</span>
                    </a>
                  )}
                </div>
              </li>
            )
          })}

          {deVecinos.map((v) => {
            const tel = v.telefono?.replace(/\D/g, '') ?? ''
            const wa =
              tel.length >= 10
                ? `https://wa.me/${tel.startsWith('57') ? tel : `57${tel}`}?text=${encodeURIComponent(
                    `Hola, vi tu publicación "${v.titulo}" en AquíAyuda y puedo ayudarte con alojamiento.`,
                  )}`
                : null
            return (
              <li key={v.id} style={{ padding: 'var(--sp-4) var(--sp-5)', borderTop: '1px solid var(--border)', minWidth: 0 }}>
                <div className="row row--wrap" style={{ marginBottom: 'var(--sp-2)' }}>
                  {v.urgente && <Badge tono="critical">Urgente</Badge>}
                  <span className="min0" style={{ flex: '1 1 12rem', fontWeight: 650 }}>
                    {v.titulo}
                  </span>
                  <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
                    {desde(v.creadaEn)}
                  </span>
                </div>
                {v.descripcion && <p className="detalle-nota">{v.descripcion}</p>}
                <div className="row row--wrap" style={{ marginTop: 'var(--sp-3)' }}>
                  <SelloFuente origen="pereira-unida" />
                  <span className="truncate min0" style={{ flex: '1 1 8rem', color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
                    {[v.lugar, v.municipio].filter(Boolean).join(' · ')}
                  </span>
                  <div className="spacer" />
                  <ComoLlegar
                    destino={{ lat: v.lat, lng: v.lng, direccion: v.lugar, zona: v.municipio }}
                    variante="enlace"
                    modo="ver"
                  />
                  {wa && (
                    <a className="btn btn--sm btn--primary" href={wa} target="_blank" rel="noopener noreferrer">
                      <MessageCircle size={15} />
                      <span>Escribir</span>
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
