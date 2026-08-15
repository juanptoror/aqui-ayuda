import {
  CheckCircle2,
  Clock,
  MessageCircle,
  PackageCheck,
  Truck,
  UserCheck,
} from 'lucide-react'
import { Sheet, Badge, Notice } from './ui'
import { ComoLlegar } from './ComoLlegar'
import { SelloFuente } from './Fuente'
import { enlaceWhatsapp, type AyudaCorag } from '@/backends/corag'
import { numero, desde } from '@/lib/format'

/**
 * La ficha completa de una publicación de Corag.
 *
 * No hace ninguna petición nueva: `?view=detail&id=` devuelve **exactamente**
 * lo mismo que el elemento de la lista —comprobado campo a campo sobre 20
 * publicaciones—, y ese elemento ya trae el desglose por recurso, las
 * confirmaciones de la comunidad, la capacidad logística y la línea de tiempo.
 * Todo eso llevaba cargado desde el principio sin que nadie lo mirase.
 *
 * Cada bloque se oculta si su dato no viene, en vez de dibujar una sección
 * vacía: una publicación sencilla —"necesito pañales"— no tiene por qué
 * enseñar seis apartados en blanco.
 */

/* Los tipos de evento que publica Corag, con su icono y si llevan texto de la
   comunidad. Un tipo desconocido se pinta igual con su título tal cual: mejor
   un evento sin icono que un hueco. */
const EVENTOS: Record<string, { icono: typeof Clock; tono?: 'exito' | 'aviso' }> = {
  published: { icono: Clock },
  confirmed: { icono: CheckCircle2, tono: 'exito' },
  contacted: { icono: MessageCircle },
  comment: { icono: MessageCircle },
  commitment_reserved: { icono: PackageCheck, tono: 'aviso' },
  commitment_activated: { icono: UserCheck, tono: 'exito' },
  commitment_cancelled: { icono: Clock },
  completed: { icono: CheckCircle2, tono: 'exito' },
  no_longer_needed: { icono: CheckCircle2 },
}

/** El estado de seguimiento, en las palabras que usa la propia Corag. */
function seguimiento(a: AyudaCorag): { texto: string; tono: 'critical' | 'warning' | 'success' | 'neutral' } {
  const contactos = a.contact?.contactCount ?? 0
  if (a.operationalStatus === 'in_process' || a.quantities?.committed) {
    return { texto: 'En coordinación', tono: 'success' }
  }
  if (contactos > 0) return { texto: 'Contactada', tono: 'warning' }
  return { texto: 'Publicada', tono: 'neutral' }
}

export function FichaAyuda({
  ayuda,
  alCerrar,
}: {
  ayuda: AyudaCorag | null
  alCerrar: () => void
}) {
  if (!ayuda) return <Sheet abierta={false} alCerrar={alCerrar} titulo="" children={null} />

  const a = ayuda
  const wa = enlaceWhatsapp(a.contact?.whatsapp ?? null, a.title)
  const s = seguimiento(a)
  const q = a.quantities
  const recursos = a.resources ?? []
  const linea = a.timeline ?? []
  const cobertura = q?.coveragePercentage ?? null

  return (
    <Sheet
      abierta
      alCerrar={alCerrar}
      titulo={a.title}
      subtitulo={[a.location?.neighborhood, a.location?.address].filter(Boolean).join(' · ') || undefined}
      pie={
        wa ? (
          <a className="btn btn--primary" href={wa} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={18} />
            <span>Escribir por WhatsApp</span>
          </a>
        ) : undefined
      }
    >
      <div className="stack">
        <div className="row row--wrap">
          {a.urgency === 'urgent' && <Badge tono="critical">Urgente</Badge>}
          <Badge tono={s.tono}>{s.texto}</Badge>
          <Badge tono="neutral">{a.type === 'request' ? 'Pide ayuda' : 'Ofrece ayuda'}</Badge>
          <div className="spacer" />
          <SelloFuente origen="corag" />
        </div>

        {a.description && <p style={{ margin: 0 }}>{a.description}</p>}

        {/* ---------------------------- COBERTURA ---------------------------- */}
        {q && q.required > 0 && (
          <section>
            <div className="row" style={{ marginBottom: 'var(--sp-2)' }}>
              <span className="deflist__label">Cuánto está cubierto</span>
              <div className="spacer" />
              <span className="num" style={{ fontWeight: 800 }}>
                {numero(Math.round(cobertura ?? 0))}%
              </span>
            </div>
            <div className="barra" role="img" aria-label={`${Math.round(cobertura ?? 0)}% cubierto`}>
              <span
                className="barra__relleno"
                style={{ width: `${Math.max(cobertura ?? 0, 1)}%` }}
              />
            </div>
            <div className="cifras">
              {[
                ['Requerido', q.required],
                ['Comprometido', q.committed],
                ['Entregado', q.received],
                ['Pendiente', q.pendingToCommit],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta as string} className="cifras__dato">
                  <span className="cifras__valor num">{numero(valor as number)}</span>
                  <span className="cifras__label">{etiqueta}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---------------------------- RECURSOS ----------------------------- */}
        {recursos.length > 0 && (
          <section>
            <span className="deflist__label">Qué hace falta exactamente</span>
            <ul className="lista-detalle" style={{ marginTop: 'var(--sp-2)' }}>
              {recursos.map((r) => (
                <li key={r.id}>
                  <div className="row row--wrap">
                    <span className="min0 truncate" style={{ flex: '1 1 10rem', fontWeight: 650 }}>
                      {r.label || r.category}
                    </span>
                    <span className="num" style={{ color: 'var(--text-muted)' }}>
                      {numero(r.required)} {r.unit}
                    </span>
                  </div>
                  {r.required > 0 && (
                    <div className="barra" style={{ marginTop: 'var(--sp-2)', height: 6 }}>
                      <span
                        className="barra__relleno"
                        style={{
                          width: `${Math.max(Math.round(((r.committed + r.received) / r.required) * 100), 1)}%`,
                        }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ------------------------ CAPACIDAD LOGÍSTICA ---------------------- */}
        {a.logistics && (
          <section>
            <div className="row" style={{ marginBottom: 'var(--sp-2)' }}>
              <Truck size={16} strokeWidth={2.3} />
              <span className="deflist__label">Capacidad que ofrece</span>
            </div>
            <div className="cifras">
              {a.logistics.capacityKg ? (
                <div className="cifras__dato">
                  <span className="cifras__valor num">{numero(a.logistics.capacityKg)}</span>
                  <span className="cifras__label">kg de carga</span>
                </div>
              ) : null}
              {a.logistics.capacityBoxes ? (
                <div className="cifras__dato">
                  <span className="cifras__valor num">{numero(a.logistics.capacityBoxes)}</span>
                  <span className="cifras__label">cajas</span>
                </div>
              ) : null}
              {a.logistics.passengerCapacity ? (
                <div className="cifras__dato">
                  <span className="cifras__valor num">
                    {numero(a.logistics.passengerCapacity)}
                  </span>
                  <span className="cifras__label">personas</span>
                </div>
              ) : null}
            </div>
            {a.logistics.vehicle && (
              <p style={{ margin: 'var(--sp-2) 0 0', color: 'var(--text-muted)' }}>
                {a.logistics.vehicle}
                {a.logistics.zones?.length ? ` · se mueve por ${a.logistics.zones.join(', ')}` : ''}
              </p>
            )}
          </section>
        )}

        {/* ---------------------------- CONTACTO ----------------------------- */}
        {a.contact?.name && (
          <section>
            <span className="deflist__label">Quién lo publicó</span>
            <div className="row row--wrap" style={{ marginTop: 'var(--sp-2)' }}>
              <span style={{ fontWeight: 700 }}>{a.contact.name}</span>
              {(a.contact.contactCount ?? 0) > 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  {a.contact.contactCount} {a.contact.contactCount === 1 ? 'persona ya' : 'personas ya'}{' '}
                  {a.contact.contactCount === 1 ? 'escribió' : 'escribieron'}
                </span>
              )}
              <div className="spacer" />
              <ComoLlegar
                destino={{
                  lat: a.location?.latitude,
                  lng: a.location?.longitude,
                  direccion: a.location?.address,
                  zona: a.location?.neighborhood,
                  nombre: a.title,
                }}
                variante="enlace"
              />
            </div>
          </section>
        )}

        {(a.verification?.confirmationCount ?? 0) > 0 && (
          <Notice tono="info" icono={CheckCircle2}>
            La comunidad ha confirmado {a.verification!.confirmationCount}{' '}
            {a.verification!.confirmationCount === 1 ? 'vez' : 'veces'} que esta petición sigue
            vigente
            {a.verification!.lastConfirmedAt
              ? `, la última ${desde(a.verification!.lastConfirmedAt)}`
              : ''}
            .
          </Notice>
        )}

        {/* ---------------------------- ACTIVIDAD ---------------------------- */}
        {linea.length > 0 && (
          <section>
            <span className="deflist__label">Qué ha pasado con esta ayuda</span>
            <ol className="linea-tiempo">
              {linea.map((e) => {
                const def = EVENTOS[e.type] ?? { icono: Clock }
                const Icono = def.icono
                return (
                  <li key={e.id} className="linea-tiempo__evento" data-tono={def.tono}>
                    <span className="linea-tiempo__punto">
                      <Icono size={13} strokeWidth={2.6} />
                    </span>
                    <div className="min0">
                      <div style={{ fontWeight: 650 }}>{e.title}</div>
                      {e.detail && <p className="detalle-nota">{e.detail}</p>}
                      <div
                        style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}
                      >
                        {desde(e.createdAt)}
                        {e.authorName ? ` · ${e.authorName}` : ''}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {a.publicUrl && (
          <p style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Esta publicación vive en Corag.{' '}
            <a href={a.publicUrl} target="_blank" rel="noopener noreferrer">
              Verla allí
            </a>
            , donde además puedes comprometerte a cubrirla.
          </p>
        )}
      </div>
    </Sheet>
  )
}
