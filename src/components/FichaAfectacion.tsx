import { useState } from 'react'
import { ExternalLink, Image as ImagenIcono, ThumbsUp, TriangleAlert } from 'lucide-react'
import { Badge, Notice, Sheet } from './ui'
import { ComoLlegar } from './ComoLlegar'
import { SelloFuente } from './Fuente'
import { URL_FUENTE } from '@/backends/pereira-responde'
import {
  GRAVEDADES_AFECTACION,
  TIPOS_AFECTACION,
  type Afectacion,
} from '@/dominio/modelos'
import { formatearDistancia } from '@/lib/geo'
import { conteo, desde } from '@/lib/format'

/**
 * La ficha completa de un daño.
 *
 * Existe porque el mapa la necesitaba: se tocaba un punto rojo y no había forma
 * de ver nada más que el título. Un centro de acopio sí tenía a dónde ir —su
 * pantalla— y una afectación no, así que la mitad de lo que trae la fuente
 * (gravedad, nota de quien reportó, confirmaciones, foto) se quedaba dentro del
 * dato sin que nadie pudiera mirarlo.
 *
 * No hace ninguna petición nueva: `/reports/{id}` devuelve exactamente el mismo
 * objeto que el listado, comprobado campo a campo. Todo lo que se enseña aquí
 * llegó en la primera consulta.
 *
 * **La foto se carga al abrir la ficha.** Estuvo un tiempo detrás de un botón,
 * porque pesa de 3 a 7 MB: es el archivo que salió de la cámara y la fuente no
 * publica miniaturas. No compensaba. Quien abre el detalle de un edificio
 * agrietado viene justo a ver la foto, así que ese segundo toque era fricción
 * para algo que se iba a pulsar siempre. El aviso del peso se queda —informar
 * no cuesta un clic— y lo que no se toca es la lista: 180 miniaturas de 5 MB
 * son casi un giga y ahí el ahorro sí es real.
 */
export function FichaAfectacion({
  afectacion,
  distanciaKm,
  alCerrar,
}: {
  afectacion: Afectacion | null
  /** Solo si quien abre la ficha ha podido calcularla de verdad. */
  distanciaKm?: number | null
  alCerrar: () => void
}) {
  const [indice, setIndice] = useState(0)

  if (!afectacion) return null

  const a = afectacion
  const total = a.fotos.length
  const tipo = TIPOS_AFECTACION[a.tipo]
  const hayCoordenada = a.lat != null && a.lng != null

  return (
    <Sheet
      abierta
      alCerrar={alCerrar}
      titulo={a.subtipo ?? a.titulo}
      subtitulo={`${tipo.nombre} · ${desde(a.reportadaEn)}`}
      pie={
        <>
          {/* A un daño no se navega: se enseña dónde está para rodearlo. */}
          {hayCoordenada && (
            <ComoLlegar
              destino={{ lat: a.lat, lng: a.lng, nombre: a.titulo }}
              modo="ver"
            />
          )}
          <a className="btn" href={URL_FUENTE} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={17} />
            <span>Ver en la fuente</span>
          </a>
        </>
      }
    >
      <div className="stack">
        <div className="row row--wrap">
          <Badge tono={a.tipo === 'apoyo' ? 'success' : 'neutral'}>{tipo.nombre}</Badge>
          {a.gravedad !== 'sin-clasificar' && (
            <Badge
              tono={a.gravedad === 'alta' ? 'critical' : 'warning'}
              icono={a.gravedad === 'alta' ? TriangleAlert : undefined}
            >
              {GRAVEDADES_AFECTACION[a.gravedad]}
            </Badge>
          )}
          <div className="spacer" />
          <SelloFuente origen="pereira-responde" />
        </div>

        {/* El título vive arriba solo cuando no hay subtipo; si lo hay, el
            encabezado dice "Refugio temporal" y la clase concreta va aquí. */}
        {a.subtipo && (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>{a.titulo}</p>
        )}

        {a.nota ? (
          <p style={{ margin: 0 }}>{a.nota}</p>
        ) : (
          <p style={{ margin: 0, color: 'var(--text-subtle)' }}>
            Quien lo reportó no dejó ninguna nota. Lo único que se sabe es la clase de daño y
            dónde está.
          </p>
        )}

        {/* Un servicio abierto es el único tipo al que sí conviene ir. En los
            demás el aviso se queda, pero cambia: en un corte lo que mata no es
            el edificio, es un cable en el suelo que puede seguir con corriente. */}
        {a.tipo === 'servicio-publico' ? (
          <Notice tono="warning">
            No toques postes ni cables caídos, ni te acerques a comprobarlo: pueden seguir con
            corriente. Si hay peligro inmediato, llama al <strong>123</strong>.
          </Notice>
        ) : (
          a.tipo !== 'apoyo' && (
            <Notice tono="warning">
              No te acerques a comprobarlo. Si hay peligro inmediato, llama al <strong>123</strong>.
            </Notice>
          )
        )}

        <div className="deflist">
          <div className="deflist__row">
            <div className="deflist__content">
              <div className="deflist__label">Reportado</div>
              <div className="deflist__value">{desde(a.reportadaEn)}</div>
            </div>
          </div>
          {distanciaKm != null && (
            <div className="deflist__row">
              <div className="deflist__content">
                <div className="deflist__label">Distancia</div>
                <div className="deflist__value">{formatearDistancia(distanciaKm)}</div>
              </div>
            </div>
          )}
          <div className="deflist__row">
            <div className="deflist__content">
              <div className="deflist__label">Confirmaciones de la comunidad</div>
              {/* Cero se dice con palabras: un "0" suelto se lee como "nadie lo
                  cree", y lo que pasa es que nadie ha votado todavía. */}
              <div className="deflist__value">
                {a.confirmaciones > 0
                  ? conteo(a.confirmaciones, 'persona lo confirmó', 'personas lo confirmaron')
                  : 'Todavía nadie lo ha confirmado'}
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------ FOTOS ------------------------------ */}
        {total === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
            Este reporte se publicó sin foto.
          </p>
        ) : (
          <>
            <Notice tono="info" icono={ImagenIcono}>
              La fuente publica las fotos tal como salen del teléfono, sin reducir:{' '}
              <strong>cada una pesa varios megas</strong>. Si vas con datos contados, ten en
              cuenta lo que gasta abrir varias fichas seguidas.
            </Notice>

            {/* Solo se descarga la que se está mirando. Con dos o tres fotos,
                traerlas todas de golpe multiplicaría por tres la factura de
                datos para enseñar una. */}
            <img
              src={a.fotos[Math.min(indice, total - 1)]}
              alt={`Evidencia de ${a.titulo}`}
              decoding="async"
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '52vh',
                objectFit: 'contain',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--border)',
                background: 'var(--surface-inset)',
              }}
            />

            {total > 1 && (
              <div className="chips">
                {a.fotos.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="chip"
                    onClick={() => setIndice(i)}
                    aria-pressed={i === indice}
                  >
                    <span>Foto {i + 1}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {a.confirmaciones > 0 && (
          <p
            className="row"
            style={{
              gap: 6,
              margin: 0,
              color: 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <ThumbsUp size={14} strokeWidth={2.2} />
            Confirmar un reporte se hace en el mapa de la fuente, no aquí.
          </p>
        )}
      </div>
    </Sheet>
  )
}
