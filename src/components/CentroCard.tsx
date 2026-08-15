import { Link } from 'react-router-dom'
import { CircleSlash, MapPin, Navigation, Package, Phone, User } from 'lucide-react'
import type { CentroVista } from '@/dominio/modelos'
import { formatearDistancia } from '@/lib/geo'
import { conteo, enlaceMapa, enlaceTelefono } from '@/lib/format'
import { Badge } from './ui'
import { SelloFuente } from './Fuente'

/**
 * Tarjeta de centro. Ocupa el 100% de la altura de su celda de grilla y empuja
 * el pie hacia abajo, de modo que todas las tarjetas de una fila terminan a la
 * misma altura aunque los textos midan distinto.
 */
export function CentroCard({ centro, modo }: { centro: CentroVista; modo: 'ayudar' | 'recibir' }) {
  // Un centro cerrado se marca en gris aunque tenga pedidos urgentes: si no
  // está recibiendo, ir hasta allí es un viaje perdido.
  const acento = !centro.abierto
    ? 'var(--text-subtle)'
    : centro.urgentes > 0
      ? 'var(--critical)'
      : centro.pendientes > 0
        ? 'var(--warning)'
        : 'var(--success)'

  const mapa = enlaceMapa(centro.lat, centro.lng, centro.direccion)
  const tel = enlaceTelefono(centro.telefono ?? null)

  const categorias =
    modo === 'ayudar'
      ? [
          ...new Set(
            centro.necesidades
              .filter((n) => n.estado === 'pendiente')
              .sort((a, b) => peso(b.prioridad) - peso(a.prioridad))
              .map((n) => n.categoria),
          ),
        ]
      : [...new Set(centro.inventario.filter((i) => i.cantidad > 0).map((i) => i.categoria))]

  const visibles = categorias.slice(0, 3)
  const resto = categorias.length - visibles.length

  return (
    <article className={`card card--interactive${centro.abierto ? '' : ' card--apagada'}`}>
      <span className="card__accent" style={{ ['--accent-color' as string]: acento }} />

      <div className="card__body">
        <div className="row" style={{ gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {centro.abierto ? (
            <Badge tono="success">Abierto</Badge>
          ) : (
            <Badge tono="neutral" icono={CircleSlash}>
              Cerrado
            </Badge>
          )}
          {centro.urgentes > 0 ? (
            <Badge tono="critical">{conteo(centro.urgentes, 'urgente', 'urgentes')}</Badge>
          ) : centro.pendientes > 0 ? (
            <Badge tono="warning">{conteo(centro.pendientes, 'pedido', 'pedidos')}</Badge>
          ) : null}
          <div className="spacer" />
          {centro.distanciaKm != null && (
            <span
              className="num"
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {formatearDistancia(centro.distanciaKm)}
            </span>
          )}
        </div>

        {/* El título es el enlace y su ::after cubre la tarjeta entera: el
            área táctil pasa a ser toda la tarjeta, sin anidar enlaces. */}
        <h3 className="card__title">
          <Link
            className="card__link"
            to={`/centro/${encodeURIComponent(centro.id)}`}
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            {centro.nombre}
          </Link>
        </h3>

        <div className="deflist">
          {centro.direccion && (
            <div className="deflist__row">
              <MapPin size={15} className="deflist__icon" />
              <div className="deflist__content">
                <div className="deflist__value clamp-2">{centro.direccion}</div>
              </div>
            </div>
          )}
          {centro.responsable && (
            <div className="deflist__row">
              <User size={15} className="deflist__icon" />
              <div className="deflist__content">
                <div className="deflist__value truncate">{centro.responsable}</div>
              </div>
            </div>
          )}
        </div>

        <div>
          <div
            className="deflist__label"
            style={{ marginBottom: 'var(--sp-2)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Package size={12} strokeWidth={2.5} />
            {modo === 'ayudar' ? 'Necesita' : 'Tiene disponible'}
          </div>
          {visibles.length > 0 ? (
            <div className="chips">
              {visibles.map((c) => (
                <span key={c} className="badge badge--neutral" style={{ textTransform: 'none' }}>
                  {c}
                </span>
              ))}
              {resto > 0 && (
                <span className="badge badge--neutral" style={{ textTransform: 'none' }}>
                  +{resto} más
                </span>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)', margin: 0 }}>
              {modo === 'ayudar'
                ? 'Sin pedidos pendientes ahora mismo.'
                : 'Sin existencias registradas.'}
            </p>
          )}
        </div>
      </div>

      <div className="card__footer">
        <SelloFuente origen="ayudas-pereira" />
        {mapa ? (
          <a
            className="btn btn--sm btn--soft"
            href={mapa}
            target="_blank"
            rel="noopener noreferrer"
            style={{ position: 'relative', zIndex: 1 }}
          >
            <Navigation size={15} />
            <span>Cómo llegar</span>
          </a>
        ) : (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)' }}>
            Sin dirección
          </span>
        )}
        {tel && (
          <a
            className="btn btn--sm"
            href={tel}
            aria-label={`Llamar a ${centro.nombre}`}
            style={{ position: 'relative', zIndex: 1 }}
          >
            <Phone size={15} />
            <span>Llamar</span>
          </a>
        )}
      </div>
    </article>
  )
}

function peso(p: string): number {
  return p === 'urgente' ? 3 : p === 'alta' ? 2 : 1
}
