import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HandHeart, LocateFixed, MessageCircle, PackageSearch } from 'lucide-react'
import { PageHeader, SectionHead, EmptyState, Badge, Notice, SkeletonLinea } from '@/components/ui'
import { SelloFuente, FuentesDeLaPantalla } from '@/components/Fuente'
import { CambioDeVista, VISTAS_AYUDAR } from '@/components/CambioDeVista'
import { ComoLlegar } from '@/components/ComoLlegar'
import { usePreferencias } from '@/state/preferencias'
import { useSesion } from '@/state/sesion'
import { useCentros, useNecesidades, usePeticionesPersona } from '@/datos/consultas'
import { useAyudas, enlaceWhatsapp, LIMITE_MAX } from '@/backends/corag'
import { comparar, esServicio, GENERALES, type General } from '@/dominio/taxonomia'
import { obtenerUbicacion, distanciaKm, formatearDistancia } from '@/lib/geo'
import { conteo } from '@/lib/format'
import type { Origen } from '@/components/Fuente'

/**
 * "Tengo esto, ¿a quién le sirve?".
 *
 * Es la pregunta que la aplicación no contestaba. Había cinco pantallas para
 * mirar qué falta y ninguna para partir de lo que uno tiene: quien abre el
 * maletero con veinte mercados no quiere leer 255 peticiones, quiere saber
 * cuáles cubre.
 *
 * Cruza contra las tres fuentes a la vez usando la taxonomía común, y ordena
 * por urgencia y distancia. Lo que aparece arriba es lo que más se resuelve con
 * lo que llevas encima.
 */

interface Encaje {
  id: string
  titulo: string
  detalle: string | null
  lugar: string | null
  urgente: boolean
  exacto: boolean
  distancia: number | null
  origen: Origen
  telefono: string | null
  whatsapp: string | null
  lat: number | null
  lng: number | null
  enlaceInterno: string | null
}

/* Lo que la gente tiene, en sus palabras, mapeado a la taxonomía común. El
   vocabulario de partida es el de Corag porque es el más cercano al habla
   corriente: nadie dice "alimentos no perecederos", dice "comida". */
const RECURSOS: { id: string; etiqueta: string; categoria: string; general: General }[] = [
  { id: 'comida', etiqueta: 'Comida', categoria: 'alimentos', general: 'agua-alimentacion' },
  { id: 'agua', etiqueta: 'Agua', categoria: 'agua', general: 'agua-alimentacion' },
  { id: 'medicamentos', etiqueta: 'Medicamentos', categoria: 'medicamentos', general: 'salud' },
  { id: 'salud', etiqueta: 'Atención en salud', categoria: 'salud', general: 'salud' },
  { id: 'higiene', etiqueta: 'Aseo e higiene', categoria: 'aseo', general: 'higiene' },
  { id: 'panales', etiqueta: 'Pañales', categoria: 'bebes', general: 'higiene' },
  { id: 'ropa', etiqueta: 'Ropa', categoria: 'ropa', general: 'abrigo' },
  { id: 'cobijas', etiqueta: 'Cobijas', categoria: 'cobijas', general: 'abrigo' },
  { id: 'refugio', etiqueta: 'Un techo', categoria: 'refugio', general: 'abrigo' },
  { id: 'herramientas', etiqueta: 'Herramientas', categoria: 'herramientas', general: 'herramientas' },
  { id: 'mascotas', etiqueta: 'Cosas de mascotas', categoria: 'mascotas', general: 'animales' },
  { id: 'transporte', etiqueta: 'Transporte', categoria: 'transporte', general: 'servicios' },
  { id: 'manos', etiqueta: 'Mis manos', categoria: 'voluntariado', general: 'servicios' },
]

export function QuieroAyudar() {
  const { ubicacion, fijarUbicacion } = usePreferencias()
  const { sesion } = useSesion()
  const [recurso, setRecurso] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)

  const elegido = RECURSOS.find((r) => r.id === recurso) ?? null

  const qCentros = useCentros(!!sesion)
  const qNecesidades = useNecesidades()
  const qVecinos = usePeticionesPersona()
  const qCorag = useAyudas({ tipo: 'request', ubicacion, radioKm: 150, limite: LIMITE_MAX })

  const cargando =
    qNecesidades.isLoading || qVecinos.isLoading || qCorag.isLoading || qCentros.isLoading

  const encajes = useMemo<Encaje[]>(() => {
    if (!elegido) return []
    const lista: Encaje[] = []
    const dist = (lat: number | null, lng: number | null) =>
      ubicacion && lat != null && lng != null ? distanciaKm(ubicacion, { lat, lng }) : null

    /* Un servicio no se cruza contra inventario ni contra necesidades de
       material: nadie guarda cajas de voluntariado. Pero sí contra peticiones
       que piden ese servicio, que es justo lo que aporta quien ofrece manos. */
    const soyServicio = esServicio(elegido.categoria, 'corag')

    // 1. Centros de acopio que lo están pidiendo.
    if (!soyServicio) {
      const porCentro = new Map((qCentros.data ?? []).map((c) => [c.id, c]))
      for (const n of qNecesidades.data ?? []) {
        if (n.estado === 'cubierta') continue
        const p = comparar(elegido.categoria, 'corag', n.categoria, 'ayudas-pereira')
        if (p === 'ninguna') continue
        const c = porCentro.get(n.centroId)
        if (!c) continue
        lista.push({
          id: `ap-${n.id}`,
          titulo: c.nombre,
          detalle: n.descripcion ?? n.categoria,
          lugar: c.direccion,
          urgente: n.prioridad === 'urgente',
          exacto: p === 'exacta',
          distancia: dist(c.lat, c.lng),
          origen: 'ayudas-pereira',
          telefono: null,
          whatsapp: null,
          lat: c.lat,
          lng: c.lng,
          enlaceInterno: `/centro/${c.id}`,
        })
      }
    }

    // 2. Personas de Corag.
    for (const a of qCorag.data?.items ?? []) {
      const p = comparar(elegido.categoria, 'corag', a.category, 'corag')
      if (p === 'ninguna') continue
      lista.push({
        id: `cg-${a.id}`,
        titulo: a.title,
        detalle: a.description,
        lugar: [a.location?.neighborhood, a.location?.address].filter(Boolean).join(' · ') || null,
        urgente: a.urgency === 'urgent',
        exacto: p === 'exacta',
        distancia: a.location?.distanceKm ?? dist(a.location?.latitude ?? null, a.location?.longitude ?? null),
        origen: 'corag',
        telefono: a.contact?.whatsapp ?? null,
        whatsapp: enlaceWhatsapp(a.contact?.whatsapp ?? null, a.title),
        lat: a.location?.latitude ?? null,
        lng: a.location?.longitude ?? null,
        enlaceInterno: null,
      })
    }

    // 3. Vecinos del tablón.
    for (const v of qVecinos.data ?? []) {
      const p = comparar(elegido.categoria, 'corag', v.categoria, 'pereira-unida')
      if (p === 'ninguna') continue
      const tel = v.telefono?.replace(/\D/g, '') ?? ''
      lista.push({
        id: `pu-${v.id}`,
        titulo: v.titulo,
        detalle: v.descripcion,
        lugar: [v.lugar, v.municipio].filter(Boolean).join(' · ') || null,
        urgente: v.urgente,
        exacto: p === 'exacta',
        distancia: dist(v.lat, v.lng),
        origen: 'pereira-unida',
        telefono: v.telefono,
        whatsapp:
          tel.length >= 10
            ? `https://wa.me/${tel.startsWith('57') ? tel : `57${tel}`}?text=${encodeURIComponent(
                `Hola, vi tu publicación "${v.titulo}" en AquíAyuda y puedo ayudar.`,
              )}`
            : null,
        lat: v.lat,
        lng: v.lng,
        enlaceInterno: null,
      })
    }

    /* Primero lo urgente, luego lo que encaja exacto, luego lo cercano. Ese es
       el orden en que alguien con el carro cargado toma la decisión. */
    return lista.sort((a, b) => {
      if (a.urgente !== b.urgente) return a.urgente ? -1 : 1
      if (a.exacto !== b.exacto) return a.exacto ? -1 : 1
      if (a.distancia != null && b.distancia != null) return a.distancia - b.distancia
      if (a.distancia != null) return -1
      if (b.distancia != null) return 1
      return 0
    })
  }, [elegido, qCentros.data, qNecesidades.data, qCorag.data, qVecinos.data, ubicacion])

  const visibles = encajes.slice(0, 30)
  const urgentes = encajes.filter((e) => e.urgente).length

  async function usarMiUbicacion() {
    setBuscando(true)
    try {
      fijarUbicacion(await obtenerUbicacion())
    } catch {
      /* sin ubicación se sigue pudiendo cruzar, solo que sin ordenar por cercanía */
    } finally {
      setBuscando(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <HandHeart size={13} strokeWidth={2.6} />
            Al revés que las demás pantallas
          </>
        }
        titulo="Tengo esto, ¿a quién le sirve?"
        subtitulo={
          elegido
            ? cargando
              ? 'Cruzando con las tres fuentes…'
              : `${conteo(encajes.length, 'sitio o persona', 'sitios y personas')} donde encaja lo que tienes${urgentes > 0 ? `, ${urgentes} con urgencia` : ''}.`
            : 'Elige qué puedes aportar y te decimos dónde hace falta ahora mismo, ordenado por urgencia y cercanía.'
        }
        acciones={
          !ubicacion ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={usarMiUbicacion}
              disabled={buscando}
            >
              <LocateFixed size={18} />
              <span>{buscando ? 'Buscando…' : 'Usar mi ubicación'}</span>
            </button>
          ) : undefined
        }
      />

      <div className="container">
        <FuentesDeLaPantalla
          origenes={['ayudas-pereira', 'corag', 'pereira-unida']}
          nota="Se cruza contra las tres a la vez con una taxonomía común: los tres vocabularios son distintos y sin traducirlos no encajaría nada."
        />

        <div className="section" style={{ marginTop: 0 }}>
          <CambioDeVista vistas={VISTAS_AYUDAR} />
        </div>

        <section className="section" style={{ marginTop: 0 }}>
          <SectionHead titulo="¿Qué tienes?" />
          <div className="chips">
            {RECURSOS.map((r) => (
              <button
                key={r.id}
                type="button"
                className="chip"
                aria-pressed={recurso === r.id}
                onClick={() => setRecurso(recurso === r.id ? null : r.id)}
              >
                <span>{r.etiqueta}</span>
              </button>
            ))}
          </div>
          {elegido && (
            <p style={{ marginTop: 'var(--sp-3)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Buscando dónde hace falta <strong>{GENERALES[elegido.general].nombre.toLowerCase()}</strong>.
            </p>
          )}
        </section>

        {!elegido ? (
          <EmptyState
            icono={PackageSearch}
            titulo="Empieza por lo que puedes dar"
            texto="No hace falta que sea mucho ni que sea nuevo. Elige arriba y verás quién lo está pidiendo cerca de ti."
          />
        ) : cargando ? (
          <div className="panel">
            <div className="panel__body stack">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonLinea key={i} alto={44} />
              ))}
            </div>
          </div>
        ) : encajes.length === 0 ? (
          <EmptyState
            icono={PackageSearch}
            titulo="Nadie está pidiendo eso ahora mismo"
            texto="Es una buena noticia. Prueba con otra cosa de la lista, o mira qué falta en tu municipio."
            acciones={
              <Link className="btn btn--primary" to="/que-falta">
                <span>Ver qué falta</span>
              </Link>
            }
          />
        ) : (
          <section className="section">
            <SectionHead
              titulo="Donde encaja"
              conteo={conteo(encajes.length, 'coincidencia', 'coincidencias')}
            />

            {encajes.some((e) => !e.exacto) && (
              <Notice tono="info">
                Lo marcado como <strong>parecido</strong> no es lo mismo que pides tú: es de la
                misma familia. Antes de cargar el carro, pregunta.
              </Notice>
            )}

            <div className="panel" style={{ marginTop: 'var(--sp-4)' }}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {visibles.map((e, i) => (
                  <li
                    key={e.id}
                    style={{
                      padding: 'var(--sp-4) var(--sp-5)',
                      borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                      minWidth: 0,
                    }}
                  >
                    <div className="row row--wrap" style={{ marginBottom: 'var(--sp-2)' }}>
                      {e.urgente && <Badge tono="critical">Urgente</Badge>}
                      <Badge tono={e.exacto ? 'success' : 'neutral'}>
                        {e.exacto ? 'Justo esto' : 'Parecido'}
                      </Badge>
                      <span className="min0 truncate" style={{ flex: '1 1 12rem', fontWeight: 650 }}>
                        {e.enlaceInterno ? (
                          <Link to={e.enlaceInterno}>{e.titulo}</Link>
                        ) : (
                          e.titulo
                        )}
                      </span>
                      {e.distancia != null && (
                        <span
                          className="num"
                          style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}
                        >
                          {formatearDistancia(e.distancia)}
                        </span>
                      )}
                    </div>

                    {e.detalle && <p className="detalle-nota">{e.detalle}</p>}

                    <div className="row row--wrap" style={{ marginTop: 'var(--sp-3)' }}>
                      <SelloFuente origen={e.origen} />
                      {e.lugar && (
                        <span
                          className="truncate min0"
                          style={{
                            flex: '1 1 8rem',
                            color: 'var(--text-subtle)',
                            fontSize: 'var(--text-sm)',
                          }}
                        >
                          {e.lugar}
                        </span>
                      )}
                      <div className="spacer" />
                      <ComoLlegar
                        destino={{ lat: e.lat, lng: e.lng, direccion: e.lugar, nombre: e.titulo }}
                        variante="enlace"
                      />
                      {e.whatsapp && (
                        <a
                          className="btn btn--sm btn--primary"
                          href={e.whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle size={15} />
                          <span>Escribir</span>
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {encajes.length > visibles.length && (
              <p style={{ marginTop: 'var(--sp-3)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                Hay {encajes.length - visibles.length} coincidencias más. Estas 30 son las más
                urgentes y cercanas; con eso ya hay para varios viajes.
              </p>
            )}
          </section>
        )}
      </div>
    </>
  )
}
