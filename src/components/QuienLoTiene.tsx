import { Link } from 'react-router-dom'
import { Boxes, HandHeart, MessageCircle, Phone } from 'lucide-react'
import { Badge, Notice, Sheet } from './ui'
import { ComoLlegar } from './ComoLlegar'
import { SelloFuente } from './Fuente'
import type { CruceNecesidad } from '@/datos/useCruces'
import type { Necesidad } from '@/dominio/modelos'
import { conteo, enlaceTelefono, numero } from '@/lib/format'
import { formatearDistancia } from '@/lib/geo'

/**
 * "Me falta agua. ¿Quién tiene agua?".
 *
 * La lista de faltantes de un centro decía qué falta y ahí se acababa. Esta
 * hoja contesta la mitad que faltaba, cruzando las tres fuentes que ya estaban
 * cargadas: otros centros con existencias, gente que lo ofrece en Corag y
 * vecinos que lo ofrecen en el tablón.
 *
 * La distinción que sostiene la pantalla entera: **tener no es ofrecer.** Un
 * centro con dieciocho cajas contadas es una existencia a la que se puede
 * mandar un carro; una persona que se ofrece es una intención que hay que
 * confirmar por teléfono. Se separan en dos bloques y se nombran distinto,
 * porque un coordinador que trate un ofrecimiento como stock tacha una urgencia
 * que sigue sin cubrir.
 *
 * Y no todo lo que aparece encaja igual: "Agua" contra "Agua" es exacto, "Agua"
 * contra "Alimentos no perecederos" es de la misma familia y puede no servir.
 * La etiqueta lo dice en vez de mezclarlo todo en una sola lista.
 */
export function QuienLoTiene({
  necesidad,
  cruce,
  alCerrar,
}: {
  necesidad: Necesidad | null
  cruce: CruceNecesidad | undefined
  alCerrar: () => void
}) {
  if (!necesidad) return <Sheet abierta={false} alCerrar={alCerrar} titulo="" children={null} />

  const todos = cruce?.todos ?? []
  const conStock = todos.filter((t) => t.tipo === 'centro')
  const ofrecen = todos.filter((t) => t.tipo === 'persona')

  return (
    <Sheet
      abierta
      alCerrar={alCerrar}
      titulo={`Quién tiene ${necesidad.categoria.toLowerCase()}`}
      subtitulo={
        todos.length === 0
          ? 'Nadie, en ninguna de las tres fuentes'
          : `${conteo(todos.length, 'coincidencia', 'coincidencias')} en tres fuentes`
      }
    >
      <div className="stack">
        {todos.length === 0 ? (
          <Notice tono="warning">
            Ni otros centros ni la gente que se ofrece tienen algo que encaje con{' '}
            <strong>{necesidad.categoria.toLowerCase()}</strong> ahora mismo. No es que no se haya
            mirado: se ha mirado en las tres fuentes y no hay.
          </Notice>
        ) : (
          !cruce?.hayExacto && (
            <Notice tono="warning">
              Nada encaja <strong>exactamente</strong> con {necesidad.categoria.toLowerCase()}. Lo
              de abajo es de la misma familia y puede no servir: conviene preguntar antes de mover
              nada.
            </Notice>
          )
        )}

        {conStock.length > 0 && (
          <section>
            <div className="row" style={{ marginBottom: 'var(--sp-3)' }}>
              <Boxes size={17} strokeWidth={2.2} style={{ color: 'var(--text-subtle)' }} />
              <span className="deflist__label">Existencias contadas en otro centro</span>
              <div className="spacer" />
              <span className="num" style={{ fontWeight: 800 }}>
                {numero(conStock.length)}
              </span>
            </div>
            {/* `minmax(0, 1fr)` y no `1fr`: por defecto un elemento de rejilla
                no puede encogerse por debajo de su contenido, así que un nombre
                largo o una dirección de tres líneas ensanchaban la tarjeta 60px
                más allá del borde de la hoja y recortaban los botones. */}
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: 'var(--sp-3)',
              }}
            >
              {conStock.map((t) => (
                <li key={t.id} className="panel min0" style={{ padding: 'var(--sp-3) var(--sp-4)', minWidth: 0 }}>
                  <div className="row row--wrap" style={{ gap: 'var(--sp-2)' }}>
                    <span style={{ fontWeight: 700 }} className="min0 truncate">
                      {t.nombre}
                    </span>
                    <div className="spacer" />
                    {t.precision === 'aproximada' && <Badge tono="warning">Parecido</Badge>}
                    <Badge tono={t.abierto ? 'success' : 'neutral'}>
                      {t.abierto ? 'Abierto' : 'Cerrado'}
                    </Badge>
                  </div>

                  <div
                    className="row row--wrap"
                    style={{
                      gap: 'var(--sp-3)',
                      color: 'var(--text-muted)',
                      fontSize: 'var(--text-sm)',
                      marginTop: 4,
                    }}
                  >
                    <span className="num" style={{ fontWeight: 700, color: 'var(--text)' }}>
                      {numero(t.cantidad ?? 0)} {t.unidad}
                    </span>
                    {t.distanciaKm != null && <span>{formatearDistancia(t.distanciaKm)}</span>}
                    {t.detalle && <span className="min0 truncate">{t.detalle}</span>}
                  </div>

                  <div className="row row--wrap" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
                    <SelloFuente origen={t.origen} />
                    <div className="spacer" />
                    {t.enlaceInterno && (
                      <Link className="btn btn--sm" to={t.enlaceInterno}>
                        <span>Ver el centro</span>
                      </Link>
                    )}
                    {/* Con coordenada el mapa abre en el punto exacto; sin
                        ella, `ComoLlegar` busca la dirección y lo marca como
                        aproximado. Pasarle solo el texto teniendo el punto
                        etiquetaba de "aprox." un sitio que sí sabemos dónde está. */}
                    <ComoLlegar
                      destino={{ lat: t.lat, lng: t.lng, nombre: t.nombre, direccion: t.detalle }}
                      modo="ver"
                      tamano="sm"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {ofrecen.length > 0 && (
          <section>
            <div className="row" style={{ marginBottom: 'var(--sp-3)' }}>
              <HandHeart size={17} strokeWidth={2.2} style={{ color: 'var(--text-subtle)' }} />
              <span className="deflist__label">Personas que se ofrecen</span>
              <div className="spacer" />
              <span className="num" style={{ fontWeight: 800 }}>
                {numero(ofrecen.length)}
              </span>
            </div>

            {/* Se dice antes de la lista, no después: la diferencia entre una
                caja contada y una intención cambia lo que se hace con esto. */}
            <p
              style={{
                margin: '0 0 var(--sp-3)',
                color: 'var(--text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              Esto no es inventario: es gente que dijo que podía ayudar. Hasta que no responda al
              teléfono, la necesidad sigue abierta.
            </p>

            {/* `minmax(0, 1fr)` y no `1fr`: por defecto un elemento de rejilla
                no puede encogerse por debajo de su contenido, así que un nombre
                largo o una dirección de tres líneas ensanchaban la tarjeta 60px
                más allá del borde de la hoja y recortaban los botones. */}
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: 'var(--sp-3)',
              }}
            >
              {ofrecen.map((t) => (
                <li key={t.id} className="panel min0" style={{ padding: 'var(--sp-3) var(--sp-4)', minWidth: 0 }}>
                  <div className="row row--wrap" style={{ gap: 'var(--sp-2)' }}>
                    <span style={{ fontWeight: 700 }} className="min0 truncate">
                      {t.nombre}
                    </span>
                    <div className="spacer" />
                    {t.precision === 'aproximada' && <Badge tono="warning">Parecido</Badge>}
                  </div>

                  {t.detalle && (
                    <p
                      className="clamp-2"
                      style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}
                    >
                      {t.detalle}
                    </p>
                  )}

                  <div className="row row--wrap" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
                    <SelloFuente origen={t.origen} />
                    <div className="spacer" />
                    {t.whatsapp ? (
                      <a
                        className="btn btn--sm btn--primary"
                        href={t.whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle size={15} />
                        <span>Escribir</span>
                      </a>
                    ) : enlaceTelefono(t.telefono) ? (
                      <a className="btn btn--sm" href={enlaceTelefono(t.telefono)!}>
                        <Phone size={15} />
                        <span>Llamar</span>
                      </a>
                    ) : (
                      /* Sin teléfono no se ofrece un botón muerto: se dice que
                         el contacto hay que buscarlo en la fuente. */
                      <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
                        Sin contacto publicado
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Sheet>
  )
}
