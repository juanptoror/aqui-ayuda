import { Link } from 'react-router-dom'
import { Boxes, PackageCheck, TriangleAlert } from 'lucide-react'
import { Sheet, Badge, Notice } from './ui'
import { ComoLlegar } from './ComoLlegar'
import { SelloFuente } from './Fuente'
import type { CentroVista } from '@/dominio/modelos'
import { numero, desde } from '@/lib/format'
import { formatearDistancia } from '@/lib/geo'

/**
 * Qué hay detrás de una línea de "qué falta".
 *
 * La lista de prioridades contesta *qué* falta, pero quien va a comprar o a
 * mover algo necesita lo siguiente: en qué centro concreto falta, con qué
 * urgencia, qué han escrito ellos mismos, cuánto hay ya —para no llevar más de
 * lo mismo a un sitio que ya está lleno— y cómo llegar.
 *
 * Todo esto ya estaba cargado en memoria. No hacía falta ninguna consulta
 * nueva: solo dejar de esconderlo.
 */

interface Props {
  categoria: string | null
  centros: CentroVista[]
  alCerrar: () => void
}

const ORDEN_PRIORIDAD: Record<string, number> = { urgente: 0, normal: 1 }

export function DetalleNecesidad({ categoria, centros, alCerrar }: Props) {
  if (!categoria) {
    return <Sheet abierta={false} alCerrar={alCerrar} titulo="" children={null} />
  }

  /* Quién la pide, y con qué urgencia. Se excluyen las cubiertas: una
     necesidad ya resuelta en la lista haría llevar cosas donde ya no hacen
     falta, que es el error que esta pantalla existe para evitar. */
  const pidiendo = centros
    .flatMap((c) =>
      c.necesidades
        .filter((n) => n.categoria === categoria && n.estado !== 'cubierta')
        .map((n) => ({ centro: c, necesidad: n })),
    )
    .sort((a, b) => {
      const p =
        (ORDEN_PRIORIDAD[a.necesidad.prioridad] ?? 9) - (ORDEN_PRIORIDAD[b.necesidad.prioridad] ?? 9)
      if (p !== 0) return p
      // A igual urgencia, primero lo que pilla más cerca.
      return (a.centro.distanciaKm ?? 1e9) - (b.centro.distanciaKm ?? 1e9)
    })

  /* Y quién ya la tiene. Es la otra mitad de la decisión: si un centro a 800 m
     tiene 18 cajas, mover en vez de comprar resuelve antes y más barato. */
  const teniendo = centros
    .flatMap((c) =>
      c.inventario
        .filter((i) => i.categoria === categoria && i.cantidad > 0)
        .map((i) => ({ centro: c, item: i })),
    )
    .sort((a, b) => (a.centro.distanciaKm ?? 1e9) - (b.centro.distanciaKm ?? 1e9))

  const urgentes = pidiendo.filter((p) => p.necesidad.prioridad === 'urgente').length

  return (
    <Sheet
      abierta
      alCerrar={alCerrar}
      titulo={categoria}
      subtitulo={
        pidiendo.length === 0
          ? 'Ahora mismo ningún centro está pidiendo esto.'
          : `Lo piden ${pidiendo.length} ${pidiendo.length === 1 ? 'centro' : 'centros'}${urgentes > 0 ? `, ${urgentes} de forma urgente` : ''}.`
      }
    >
      <div className="stack">
        {teniendo.length > 0 && pidiendo.length > 0 && (
          <Notice tono="info">
            Hay {numero(teniendo.reduce((s, t) => s + t.item.cantidad, 0))}{' '}
            {teniendo[0].item.unidad} de esto en {teniendo.length}{' '}
            {teniendo.length === 1 ? 'centro' : 'centros'} del municipio. A veces mover lo que ya
            existe llega antes que comprar.
          </Notice>
        )}

        <section>
          <div className="row" style={{ marginBottom: 'var(--sp-3)' }}>
            <TriangleAlert size={16} strokeWidth={2.4} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Quién lo está pidiendo</h3>
            <div className="spacer" />
            <SelloFuente origen="ayudas-pereira" />
          </div>

          {pidiendo.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Nadie lo pide ahora mismo en este municipio.
            </p>
          ) : (
            <ul className="lista-detalle">
              {pidiendo.map(({ centro, necesidad }) => (
                <li key={necesidad.id}>
                  <div className="row row--wrap">
                    <Badge
                      tono={necesidad.prioridad === 'urgente' ? 'critical' : 'neutral'}
                    >
                      {necesidad.prioridad === 'urgente' ? 'Urgente' : 'Necesario'}
                    </Badge>
                    <Link
                      to={`/centro/${centro.id}`}
                      className="min0 truncate"
                      style={{ flex: '1 1 10rem', fontWeight: 650 }}
                    >
                      {centro.nombre}
                    </Link>
                    {centro.distanciaKm != null && (
                      <span
                        className="num"
                        style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}
                      >
                        {formatearDistancia(centro.distanciaKm)}
                      </span>
                    )}
                  </div>

                  {/* Lo que escribió el propio centro. Es lo único que dice qué
                      hace falta EXACTAMENTE: "pañales talla 3", no "pañales". */}
                  {necesidad.descripcion && (
                    <p className="detalle-nota">{necesidad.descripcion}</p>
                  )}

                  <div className="row row--wrap" style={{ marginTop: 'var(--sp-2)' }}>
                    <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
                      {centro.abierto ? 'Abierto ahora' : 'Cerrado ahora'} · pedido {desde(necesidad.creadaEn)}
                    </span>
                    <div className="spacer" />
                    <ComoLlegar
                      destino={{
                        lat: centro.lat,
                        lng: centro.lng,
                        direccion: centro.direccion,
                        nombre: centro.nombre,
                      }}
                      variante="enlace"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {teniendo.length > 0 && (
          <section>
            <div className="row" style={{ marginBottom: 'var(--sp-3)' }}>
              <Boxes size={16} strokeWidth={2.4} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Dónde ya hay</h3>
            </div>
            <ul className="lista-detalle">
              {teniendo.map(({ centro, item }) => (
                <li key={item.id}>
                  <div className="row row--wrap">
                    <PackageCheck size={16} strokeWidth={2.2} color="var(--success-solid)" />
                    <Link
                      to={`/centro/${centro.id}`}
                      className="min0 truncate"
                      style={{ flex: '1 1 10rem', fontWeight: 650 }}
                    >
                      {centro.nombre}
                    </Link>
                    <span className="num" style={{ fontWeight: 700 }}>
                      {numero(item.cantidad)} {item.unidad}
                    </span>
                    <ComoLlegar
                      destino={{
                        lat: centro.lat,
                        lng: centro.lng,
                        direccion: centro.direccion,
                        nombre: centro.nombre,
                      }}
                      variante="enlace"
                      modo="ver"
                    />
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
