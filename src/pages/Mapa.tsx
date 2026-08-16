import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LocateFixed, MapPin } from 'lucide-react'
import { PageHeader, EmptyState, Notice, SkeletonLinea } from '@/components/ui'
import { MapaPuntos, type PuntoMapa } from '@/components/MapaPuntos'
import { FuentesDeLaPantalla } from '@/components/Fuente'
import { SelectorCiudad } from '@/components/SelectorCiudad'
import { usePreferencias } from '@/state/preferencias'
import { useSesion } from '@/state/sesion'
import { useCentros } from '@/datos/consultas'
import { useAyudas, LIMITE_MAX } from '@/backends/corag'
import { obtenerUbicacion, coordenadaDeCiudad, distanciaKm } from '@/lib/geo'
import { conteo } from '@/lib/format'

/**
 * Las dos fuentes en una sola vista.
 *
 * Es el único sitio de la aplicación donde centros y personas aparecen juntos.
 * Por separado cada lista responde "qué hay"; juntas responden la pregunta que
 * de verdad se hace alguien con un carro cargado: "¿qué me pilla de camino?".
 *
 * Se filtra por radio en vez de por municipio: los límites administrativos no
 * significan nada cuando lo que importa son diez minutos de coche, y Pereira y
 * Dosquebradas están pegadas.
 */

const RADIOS = [5, 15, 30, 60]

export function Mapa() {
  const navegar = useNavigate()
  const { ubicacion, fijarUbicacion, ciudadGuardada } = usePreferencias()
  const { sesion } = useSesion()
  const [radioKm, setRadioKm] = useState(15)
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null)

  const qCentros = useCentros(!!sesion)
  /* Dos consultas y no una: la API exige `type` y responde 400 sin él. El
     mapa necesita las dos caras —quien pide y quien ofrece— así que pregunta
     dos veces y las junta aquí. */
  const qPeticiones = useAyudas({ tipo: 'request', ubicacion, radioKm, limite: LIMITE_MAX })
  const qOfertas = useAyudas({ tipo: 'offer', ubicacion, radioKm, limite: LIMITE_MAX })

  /* Sin ubicación del navegador se usa el centro del municipio guardado: casi
     siempre basta para encuadrar, y evita la pantalla vacía.

     Sin ninguna de las dos NO se inventa un origen. Poner Pereira por defecto
     le diría a alguien de Manizales "esto es lo que tienes a 15 km" señalando
     otro departamento, y le escondería lo que sí tiene al lado. Se enseña el
     país entero y el texto lo dice; el radio, mientras tanto, no se promete. */
  const origen = useMemo(() => {
    if (ubicacion) return ubicacion
    if (!ciudadGuardada) return null
    return coordenadaDeCiudad(ciudadGuardada)
  }, [ubicacion, ciudadGuardada])

  const puntos = useMemo<PuntoMapa[]>(() => {
    const lista: PuntoMapa[] = []

    for (const c of qCentros.data ?? []) {
      if (c.lat == null || c.lng == null || !c.activo) continue
      if (origen && distanciaKm(origen, { lat: c.lat, lng: c.lng }) > radioKm) continue
      lista.push({
        id: `ap-${c.id}`,
        lat: c.lat,
        lng: c.lng,
        titulo: c.nombre,
        detalle: [c.abierto ? 'Abierto ahora' : 'Cerrado', c.direccion].filter(Boolean).join(' · '),
        origen: 'ayudas-pereira',
        destacado: c.abierto,
        alPulsar: () => navegar(`/centro/${c.id}`),
      })
    }

    const deCorag = [...(qPeticiones.data?.items ?? []), ...(qOfertas.data?.items ?? [])]
    for (const a of deCorag) {
      const lat = a.location?.latitude
      const lng = a.location?.longitude
      if (lat == null || lng == null) continue
      /* El mismo radio que a los centros. Sin esto la API devuelve toda la
         emergencia —no le mandamos coordenadas porque el origen puede ser el
         centro del municipio, no la posición real— y dos puntos lejanos
         estiraban el encuadre hasta amontonar los demás en una mancha. */
      if (origen && distanciaKm(origen, { lat, lng }) > radioKm) continue
      lista.push({
        id: `cg-${a.id}`,
        lat,
        lng,
        titulo: a.title,
        detalle: [
          a.type === 'request' ? 'Pide ayuda' : 'Ofrece ayuda',
          a.urgency === 'urgent' ? 'Urgente' : null,
          a.location?.neighborhood,
        ]
          .filter(Boolean)
          .join(' · '),
        origen: 'corag',
        destacado: a.urgency === 'urgent',
      })
    }

    return lista
  }, [qCentros.data, qPeticiones.data, qOfertas.data, origen, radioKm, navegar])

  async function usarMiUbicacion() {
    setBuscando(true)
    setErrorUbicacion(null)
    try {
      const c = await obtenerUbicacion()
      fijarUbicacion(c)
    } catch (e) {
      setErrorUbicacion(
        e instanceof Error ? e.message : 'No se pudo obtener tu ubicación.',
      )
    } finally {
      setBuscando(false)
    }
  }

  /* Solo se considera "cargando" mientras no haya NADA que dibujar. Los centros
     llegan de Supabase en un parpadeo y Corag tarda bastante más; bloquear el
     mapa entero por la fuente lenta deja un rectángulo gris varios segundos.
     Así aparecen los centros de inmediato y las personas se suman después. */
  const esperandoAlgo = qCentros.isLoading || qPeticiones.isLoading || qOfertas.isLoading
  const cargando = esperandoAlgo && puntos.length === 0
  const completandose = esperandoAlgo && puntos.length > 0
  const centros = puntos.filter((p) => p.origen === 'ayudas-pereira').length
  const personas = puntos.length - centros

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <MapPin size={13} strokeWidth={2.6} />
            Las dos fuentes juntas
          </>
        }
        titulo="Mapa de la ayuda"
        subtitulo={
          cargando
            ? 'Buscando ubicaciones en las dos fuentes…'
            : /* El radio solo se nombra cuando de verdad se aplica. Sin origen no
                 hay nada que filtrar, y decir "en un radio de 15 km" sobre un
                 mapa del país entero es prometer una cercanía que no existe. */
              `${conteo(centros, 'centro de acopio', 'centros de acopio')} y ${conteo(personas, 'persona', 'personas')} ${
                origen ? `en un radio de ${radioKm} km` : 'en todo el país, sin acotar por distancia'
              }.`
        }
        acciones={
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={usarMiUbicacion}
              disabled={buscando}
            >
              <LocateFixed size={18} />
              <span>{buscando ? 'Buscando…' : 'Usar mi ubicación'}</span>
            </button>
            <button type="button" className="btn" onClick={() => setSelectorAbierto(true)}>
              <span>Elegir municipio</span>
            </button>
          </>
        }
      />

      <div className="container">
        <FuentesDeLaPantalla
          origenes={['ayudas-pereira', 'corag']}
          nota="Cuadrados los centros de acopio, círculos las personas. Cada fuente publica su propia coordenada; ninguna de las dos cubre a la otra."
        />

        {(errorUbicacion || !origen) && (
          <div className="stack">
            {errorUbicacion && <Notice tono="warning">{errorUbicacion}</Notice>}
            {!origen && (
              <Notice
                tono="info"
                accion={
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => setSelectorAbierto(true)}
                  >
                    <span>Elegir municipio</span>
                  </button>
                }
              >
                Estás viendo <strong>todo el país</strong>: sin saber dónde estás no hay radio
                que aplicar. Dinos tu ubicación o elige municipio y encuadramos el mapa a tu
                alrededor.
              </Notice>
            )}
          </div>
        )}

        <section className="section" style={{ marginTop: errorUbicacion || !origen ? undefined : 0 }}>
          {/* Las chips solo aparecen cuando hay origen. Un selector de radio que
              no recorta nada es la misma mentira que el texto, en otro sitio. */}
          {origen && (
            <div className="chips" style={{ marginBottom: 'var(--sp-4)' }}>
              {RADIOS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="chip"
                  onClick={() => setRadioKm(r)}
                  aria-pressed={r === radioKm}
                >
                  <span>{r} km</span>
                </button>
              ))}
            </div>
          )}

          {cargando ? (
            <div
              className="mapa"
              style={{ display: 'grid', placeItems: 'center', gap: 'var(--sp-3)' }}
            >
              <MapPin size={30} strokeWidth={1.6} color="var(--text-subtle)" />
              <span style={{ color: 'var(--text-muted)' }}>Colocando centros y personas…</span>
              <SkeletonLinea ancho="14rem" alto={10} />
            </div>
          ) : puntos.length === 0 ? (
            <EmptyState
              icono={MapPin}
              titulo="No hay nada con coordenadas en este radio"
              texto={
                origen
                  ? 'Ni los centros ni las personas de este radio han dejado su ubicación. Prueba a ampliarlo.'
                  : 'Dinos dónde estás y encuadramos el mapa a tu alrededor.'
              }
              acciones={
                origen ? (
                  <button type="button" className="btn btn--primary" onClick={() => setRadioKm(60)}>
                    <span>Ampliar a 60 km</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={usarMiUbicacion}
                    disabled={buscando}
                  >
                    <span>Usar mi ubicación</span>
                  </button>
                )
              }
            />
          ) : (
            <>
              <MapaPuntos puntos={puntos} yoEstoyAqui={ubicacion} />
              {completandose && (
                <p
                  style={{
                    marginTop: 'var(--sp-3)',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  Aún llegando datos de la otra fuente…
                </p>
              )}
            </>
          )}

          <p
            style={{
              marginTop: 'var(--sp-4)',
              color: 'var(--text-subtle)',
              fontSize: 'var(--text-sm)',
            }}
          >
            Las calles son de OpenStreetMap. Si la red va justa y no llegan, debajo queda un
            esquema con las mismas posiciones dibujado en tu dispositivo: el mapa no se te va a
            quedar en gris.
          </p>
        </section>
      </div>

      <SelectorCiudad abierto={selectorAbierto} alCerrar={() => setSelectorAbierto(false)} />
    </>
  )
}
