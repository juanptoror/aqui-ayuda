import { Link } from 'react-router-dom'
import { HandHeart, PackageCheck, TriangleAlert } from 'lucide-react'
import { usePanorama } from '@/backends/corag/ayudas'
import { SectionHead, SkeletonLinea } from './ui'
import { SelloFuente } from './Fuente'

/**
 * Las cifras de la emergencia, tal como las publica Corag.
 *
 * La barra de cobertura es el dato incómodo: hoy hay 5 unidades comprometidas
 * de 1345 pedidas. Se muestra igual. Una portada que solo enseñe "229 personas
 * piden ayuda" sin decir cuánto se ha cubierto está contando media historia, y
 * la mitad que falta es justo la que mueve a alguien a actuar.
 *
 * Si la API no responde, esto no se dibuja: un cero inventado aquí sería peor
 * que el hueco.
 */
export function PanoramaCorag() {
  const { data, isLoading, isError } = usePanorama()

  if (isError) return null

  const c = data?.counts
  const q = data?.quantities
  const pedido = q?.required ?? 0
  const cubierto = (q?.committed ?? 0) + (q?.received ?? 0)
  const porcentaje = pedido > 0 ? Math.min(100, Math.round((cubierto / pedido) * 100)) : 0

  return (
    <section className="section">
      <SectionHead
        titulo="Cómo va la emergencia"
        acciones={<SelloFuente origen="corag" />}
      />

      {isLoading ? (
        <div className="grid grid--kpi">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="kpi">
              <SkeletonLinea ancho="45%" />
              <SkeletonLinea ancho="30%" alto={28} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid--kpi">
            <div className="kpi kpi--critical">
              <div className="kpi__top">
                <span className="kpi__icon">
                  <TriangleAlert size={17} />
                </span>
                <span className="kpi__label">Urgentes</span>
              </div>
              <span className="kpi__value num">{c?.urgentRequests ?? 0}</span>
              <span className="kpi__hint">no pueden esperar</span>
            </div>

            <div className="kpi">
              <div className="kpi__top">
                <span className="kpi__icon">
                  <HandHeart size={17} />
                </span>
                <span className="kpi__label">Piden ayuda</span>
              </div>
              <span className="kpi__value num">{c?.activeRequests ?? 0}</span>
              <span className="kpi__hint">solicitudes activas</span>
            </div>

            <div className="kpi kpi--success">
              <div className="kpi__top">
                <span className="kpi__icon">
                  <PackageCheck size={17} />
                </span>
                <span className="kpi__label">Ofrecen</span>
              </div>
              <span className="kpi__value num">{c?.activeOffers ?? 0}</span>
              <span className="kpi__hint">
                {c?.completed ?? 0} ya resueltas
              </span>
            </div>
          </div>

          {pedido > 0 && (
            <div className="panel panel--raised" style={{ marginTop: 'var(--sp-4)' }}>
              <div className="panel__body">
                <div className="row row--wrap" style={{ marginBottom: 'var(--sp-3)' }}>
                  <div className="min0" style={{ flex: '1 1 14rem' }}>
                    <div className="deflist__label">Cuánto de lo pedido está cubierto</div>
                    <div style={{ fontWeight: 800, fontSize: '1.5rem' }} className="num">
                      {porcentaje}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                    <div className="num" style={{ fontWeight: 700 }}>
                      {cubierto.toLocaleString('es-CO')} de {pedido.toLocaleString('es-CO')}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)' }}>unidades comprometidas</div>
                  </div>
                </div>

                <div
                  className="barra"
                  role="img"
                  aria-label={`${porcentaje} por ciento de lo pedido está comprometido`}
                >
                  <span className="barra__relleno" style={{ width: `${Math.max(porcentaje, 1)}%` }} />
                </div>

                <p
                  style={{
                    margin: 'var(--sp-3) 0 0',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  Quedan {(q?.pending ?? 0).toLocaleString('es-CO')} unidades sin cubrir.{' '}
                  <Link to="/ayuda-directa">Mira quién las está pidiendo</Link>.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
