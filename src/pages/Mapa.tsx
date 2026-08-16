import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LocateFixed, MapPin } from 'lucide-react'
import { PageHeader, EmptyState, Notice, SkeletonLinea } from '@/components/ui'
import { MapaPuntos, type PuntoMapa } from '@/components/MapaPuntos'
import { FichaAfectacion } from '@/components/FichaAfectacion'
import { FichaAyuda } from '@/components/FichaAyuda'
import { FuentesDeLaPantalla } from '@/components/Fuente'
import { SelectorCiudad } from '@/components/SelectorCiudad'
import { usePreferencias } from '@/state/preferencias'
import { useSesion } from '@/state/sesion'
import { useAfectaciones, useCentros } from '@/datos/consultas'
import { useAyudas, LIMITE_MAX, type AyudaCorag } from '@/backends/corag'
import { TIPOS_AFECTACION, GRAVEDADES_AFECTACION, type Afectacion } from '@/dominio/modelos'
import { obtenerUbicacion, coordenadaDeCiudad, distanciaKm } from '@/lib/geo'
import { conteo } from '@/lib/format'

/**
 * Las fuentes en una sola vista.
 *
 * Es el único sitio de la aplicación donde centros, personas y daños aparecen
 * juntos. Por separado cada lista responde "qué hay"; juntas responden la
 * pregunta que de verdad se hace alguien con un carro cargado: "¿qué me pilla
 * de camino y por dónde no paso?".
 *
 * Los daños son la capa que se puede apagar, y nace encendida. Encendida es la
 * respuesta correcta —una vía cortada cambia la ruta antes de arrancar— pero
 * son 180 puntos rojos sobre el centro de Pereira y hay momentos en que estorban
 * para ver los centros. Apagarla es una decisión de quien mira; empezar apagada
 * sería una decisión nuestra de esconder un peligro.
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
  const [verDanos, setVerDanos] = useState(true)
  /* Tocar un punto tiene que llevar a algún sitio, sea cual sea su forma. El
     centro tiene pantalla propia; la persona y el daño se abren en su ficha,
     la misma que usan `/ayuda-directa` y `/danos`. Antes solo el cuadrado
     llevaba a alguna parte y las otras dos formas eran callejones sin salida. */
  const [fichaAyuda, setFichaAyuda] = useState<AyudaCorag | null>(null)
  const [fichaDano, setFichaDano] = useState<Afectacion | null>(null)

  const qCentros = useCentros(!!sesion)
  const qDanos = useAfectaciones()
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
        alPulsar: () => setFichaAyuda(a),
      })
    }

    if (verDanos) {
      for (const d of qDanos.data ?? []) {
        if (d.lat == null || d.lng == null) continue
        if (origen && distanciaKm(origen, { lat: d.lat, lng: d.lng }) > radioKm) continue
        lista.push({
          id: `pr-${d.id}`,
          lat: d.lat,
          lng: d.lng,
          titulo: d.titulo,
          detalle: [
            TIPOS_AFECTACION[d.tipo].nombre,
            d.gravedad === 'sin-clasificar' ? null : GRAVEDADES_AFECTACION[d.gravedad],
            d.nota,
          ]
            .filter(Boolean)
            .join(' · '),
          origen: 'pereira-responde',
          destacado: d.gravedad === 'alta',
          etiquetaAccion: 'Ver el daño',
          alPulsar: () => setFichaDano(d),
        })
      }
    }

    return lista
  }, [qCentros.data, qPeticiones.data, qOfertas.data, qDanos.data, verDanos, origen, radioKm, navegar])

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
  const esperandoAlgo =
    qCentros.isLoading || qPeticiones.isLoading || qOfertas.isLoading || qDanos.isLoading
  const cargando = esperandoAlgo && puntos.length === 0
  const completandose = esperandoAlgo && puntos.length > 0
  const centros = puntos.filter((p) => p.origen === 'ayudas-pereira').length
  const danos = puntos.filter((p) => p.origen === 'pereira-responde').length
  const personas = puntos.length - centros - danos

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <MapPin size={13} strokeWidth={2.6} />
            Las tres fuentes juntas
          </>
        }
        titulo="Mapa de la ayuda"
        subtitulo={
          cargando
            ? 'Buscando ubicaciones en las tres fuentes…'
            : /* El radio solo se nombra cuando de verdad se aplica. Sin origen no
                 hay nada que filtrar, y decir "en un radio de 15 km" sobre un
                 mapa del país entero es prometer una cercanía que no existe.
                 Los daños solo se cuentan si la capa está encendida: nombrar
                 cero daños con la capa apagada sonaría a que no hay ninguno. */
              `${conteo(centros, 'centro de acopio', 'centros de acopio')}, ${conteo(personas, 'persona', 'personas')}${
                verDanos ? ` y ${conteo(danos, 'daño reportado', 'daños reportados')}` : ''
              } ${
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
          origenes={['ayudas-pereira', 'corag', 'pereira-responde']}
          nota="Cuadrados los centros de acopio, círculos lima las personas, círculos rojos los daños y las vías cerradas. Cada fuente publica su propia coordenada y ninguna cubre a las otras: los daños, además, solo llegan de Pereira."
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
          {/* Las chips de radio solo aparecen cuando hay origen. Un selector de
              radio que no recorta nada es la misma mentira que el texto, en
              otro sitio. La de daños aparece siempre: no depende de dónde estés. */}
          <div className="chips" style={{ marginBottom: 'var(--sp-4)' }}>
            {origen &&
              RADIOS.map((r) => (
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
            <button
              type="button"
              className="chip"
              onClick={() => setVerDanos((v) => !v)}
              aria-pressed={verDanos}
              title="Puntos rojos: edificios afectados y vías cerradas en Pereira"
            >
              <span>Ver daños</span>
            </button>
          </div>

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
                  ? 'Ni los centros, ni las personas, ni los daños de este radio han dejado una ubicación. Prueba a ampliarlo.'
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
                  Aún llegando datos de alguna fuente…
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
      <FichaAyuda ayuda={fichaAyuda} alCerrar={() => setFichaAyuda(null)} />
      {/* `key` por reporte: sin ella la foto abierta de uno seguiría abierta al
          abrir el siguiente, y son varios megas que nadie pidió. */}
      <FichaAfectacion
        key={fichaDano?.id ?? 'ninguna'}
        afectacion={fichaDano}
        distanciaKm={
          origen && fichaDano?.lat != null && fichaDano?.lng != null
            ? distanciaKm(origen, { lat: fichaDano.lat, lng: fichaDano.lng })
            : null
        }
        alCerrar={() => setFichaDano(null)}
      />
    </>
  )
}
