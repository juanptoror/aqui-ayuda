import { useMemo, useState } from 'react'
import {
  Camera,
  Clock,
  Construction,
  ExternalLink,
  Image as ImagenIcono,
  LocateFixed,
  Route,
  ThumbsUp,
  TriangleAlert,
} from 'lucide-react'
import {
  AvisoError,
  Badge,
  EmptyState,
  Kpi,
  Notice,
  PageHeader,
  SectionHead,
  Sheet,
  SkeletonTarjeta,
} from '@/components/ui'
import { ComoLlegar } from '@/components/ComoLlegar'
import { FuentesDeLaPantalla, SelloFuente } from '@/components/Fuente'
import { MapaPuntos, type PuntoMapa } from '@/components/MapaPuntos'
import { SelectorCiudad } from '@/components/SelectorCiudad'
import { useAfectaciones } from '@/datos/consultas'
import { LIMITE_MAX, URL_FUENTE } from '@/backends/pereira-responde'
import {
  GRAVEDADES_AFECTACION,
  TIPOS_AFECTACION,
  type Afectacion,
  type TipoAfectacion,
} from '@/dominio/modelos'
import { usePreferencias } from '@/state/preferencias'
import { coordenadaDeCiudad, distanciaKm, formatearDistancia, obtenerUbicacion } from '@/lib/geo'
import { conteo, desde, numero } from '@/lib/format'

/**
 * El estado del terreno: qué edificio está tocado y por qué calle no se pasa.
 *
 * Es la única pantalla de la aplicación que no habla de ayuda. Las demás
 * responden "quién necesita qué"; ésta responde "por dónde no ir" y "de qué
 * apartarse", que es la pregunta previa a todas las otras: no se puede llevar
 * una carga a un centro de acopio por una vía cortada, ni volver a dormir a una
 * casa que está a punto de caerse.
 *
 * Tres decisiones que no son de estilo:
 *
 * 1. **Aquí no se reporta.** La API pública de la fuente es de solo lectura, así
 *    que el botón de reportar es un enlace a su mapa. Un formulario nuestro que
 *    no tuviera dónde escribir sería la peor pantalla posible: alguien se juega
 *    acercarse a un edificio inestable para dejar constancia y el reporte se
 *    pierde.
 *
 * 2. **Las fotos no se cargan solas.** Vienen sin reducir desde el teléfono de
 *    quien reportó: entre 3 y 7 MB cada una, medidas. Una rejilla de 180
 *    tarjetas con miniatura son cientos de megas sobre la red de una ciudad que
 *    acaba de temblar. Se cargan una a una y solo cuando alguien las pide.
 *
 * 3. **La fuente solo cubre Pereira.** Si alguien mira esto desde Manizales, la
 *    pantalla dice que no hay datos de su municipio en vez de dejar que lea
 *    "cero daños" como si su ciudad estuviera intacta.
 */

const RADIOS = [1, 3, 10, 30]

type FiltroTipo = 'todo' | TipoAfectacion

const FILTROS: { id: FiltroTipo; etiqueta: string }[] = [
  { id: 'todo', etiqueta: 'Todo' },
  { id: 'vivienda', etiqueta: TIPOS_AFECTACION.vivienda.plural },
  { id: 'via', etiqueta: TIPOS_AFECTACION.via.plural },
  { id: 'apoyo', etiqueta: TIPOS_AFECTACION.apoyo.plural },
]

const UN_DIA_MS = 24 * 60 * 60 * 1000

function esReciente(iso: string): boolean {
  const t = Date.parse(iso)
  return Number.isFinite(t) && Date.now() - t < UN_DIA_MS
}

/** Una afectación ya situada respecto a quien mira. */
interface AfectacionVista extends Afectacion {
  distanciaKm: number | null
  reciente: boolean
}

export function Danos() {
  const { ubicacion, fijarUbicacion, ciudadGuardada } = usePreferencias()
  const [tipo, setTipo] = useState<FiltroTipo>('todo')
  const [soloAlto, setSoloAlto] = useState(false)
  const [soloRecientes, setSoloRecientes] = useState(false)
  const [radioKm, setRadioKm] = useState(30)
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null)
  const [fotosDe, setFotosDe] = useState<AfectacionVista | null>(null)

  const consulta = useAfectaciones()

  /* Mismo criterio que el mapa de la ayuda: la ubicación real manda, el centro
     del municipio guardado sirve de respaldo, y sin ninguna de las dos NO se
     inventa un origen. Sin origen no hay distancias ni radio, y la pantalla lo
     dice en vez de prometer una cercanía que no ha calculado. */
  const origen = useMemo(() => {
    if (ubicacion) return ubicacion
    if (!ciudadGuardada) return null
    return coordenadaDeCiudad(ciudadGuardada)
  }, [ubicacion, ciudadGuardada])

  /* El centro de un municipio NO es dónde está la persona: son kilómetros de
     diferencia dentro de la misma ciudad. Las distancias se calculan igual
     —sirven para ordenar— pero el texto no dice "de donde estás" hasta que lo
     sabe de verdad. */
  const desdeElGps = !!ubicacion
  const referencia = desdeElGps ? 'de donde estás' : 'del centro del municipio'

  const todas = useMemo<AfectacionVista[]>(() => {
    const lista = (consulta.data ?? []).map((a) => ({
      ...a,
      distanciaKm:
        origen && a.lat != null && a.lng != null
          ? distanciaKm(origen, { lat: a.lat, lng: a.lng })
          : null,
      reciente: esReciente(a.reportadaEn),
    }))

    /* Con origen, lo más cercano primero: la pregunta es "qué tengo alrededor".
       Sin origen no hay cercanía que ordenar y manda lo más nuevo, que es lo que
       puede haber cambiado desde la última réplica. A igual distancia, el riesgo
       alto sube: entre dos cosas en la misma esquina, primero la que puede caer. */
    const peso = { alta: 0, media: 1, 'sin-clasificar': 2 } as const
    return lista.sort((a, b) => {
      if (a.distanciaKm != null && b.distanciaKm != null && a.distanciaKm !== b.distanciaKm) {
        return a.distanciaKm - b.distanciaKm
      }
      if (peso[a.gravedad] !== peso[b.gravedad]) return peso[a.gravedad] - peso[b.gravedad]
      return Date.parse(b.reportadaEn) - Date.parse(a.reportadaEn)
    })
  }, [consulta.data, origen])

  /** Lo que hay alrededor, antes de aplicar los filtros de la barra. */
  const enRadio = useMemo(
    () =>
      origen
        ? todas.filter((a) => a.distanciaKm != null && a.distanciaKm <= radioKm)
        : todas,
    [todas, origen, radioKm],
  )

  const visibles = useMemo(
    () =>
      enRadio.filter((a) => {
        if (tipo !== 'todo' && a.tipo !== tipo) return false
        if (soloAlto && a.gravedad !== 'alta') return false
        if (soloRecientes && !a.reciente) return false
        return true
      }),
    [enRadio, tipo, soloAlto, soloRecientes],
  )

  const puntos = useMemo<PuntoMapa[]>(
    () =>
      visibles
        .filter((a) => a.lat != null && a.lng != null)
        .map((a) => ({
          id: `pr-${a.id}`,
          lat: a.lat as number,
          lng: a.lng as number,
          titulo: a.titulo,
          detalle: [
            TIPOS_AFECTACION[a.tipo].nombre,
            a.gravedad === 'sin-clasificar' ? null : GRAVEDADES_AFECTACION[a.gravedad],
            a.nota,
          ]
            .filter(Boolean)
            .join(' · '),
          origen: 'pereira-responde',
          destacado: a.gravedad === 'alta',
        })),
    [visibles],
  )

  const cargando = consulta.isLoading
  const altos = enRadio.filter((a) => a.gravedad === 'alta').length
  const vias = enRadio.filter((a) => a.tipo === 'via').length
  const recientes = enRadio.filter((a) => a.reciente).length
  const sinUbicar = visibles.filter((a) => a.lat == null || a.lng == null).length
  /* La API no pagina y tope. Si llegan exactamente 500, puede haber más y no hay
     forma de pedirlas: eso se dice, no se disimula enseñando 500 como el total. */
  const puedeHaberMas = (consulta.data?.length ?? 0) >= LIMITE_MAX

  async function usarMiUbicacion() {
    setBuscando(true)
    setErrorUbicacion(null)
    try {
      fijarUbicacion(await obtenerUbicacion())
    } catch (e) {
      setErrorUbicacion(e instanceof Error ? e.message : 'No se pudo obtener tu ubicación.')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Construction size={13} strokeWidth={2.6} />
            Estado del terreno
          </>
        }
        titulo="Daños y vías cerradas"
        subtitulo={
          cargando
            ? 'Consultando los reportes publicados en Pereira…'
            : consulta.error
              ? 'No se pudieron leer los reportes. Abajo está el motivo.'
              : `${conteo(enRadio.length, 'afectación reportada', 'afectaciones reportadas')} ${
                  origen
                    ? `a menos de ${radioKm} km ${referencia}`
                    : 'en Pereira, sin acotar por distancia'
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
            {/* No hay endpoint público para publicar: reportar se hace en la
                fuente. Se dice con el icono de enlace externo, no se disfraza
                de botón de la aplicación. */}
            <a
              className="btn"
              href={URL_FUENTE}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={17} />
              <span>Reportar un daño</span>
            </a>
          </>
        }
      />

      <div className="container">
        <FuentesDeLaPantalla
          origenes={['pereira-responde']}
          nota="Cada reporte lo publica una persona desde el mapa de Pereira Responde, con foto y coordenada. Esta pantalla solo lee: para reportar algo nuevo se abre la fuente."
        />

        <div className="stack">
          {/* Lo primero, siempre: esto es un mapa de peligro, no un servicio de
              emergencia. La fuente pone el mismo aviso en su portada. */}
          <Notice tono="critical">
            <strong>Si hay peligro inmediato, llama al 123.</strong> Esta pantalla enseña lo que
            han reportado otras personas; no avisa a nadie por ti ni sustituye a los bomberos.
          </Notice>

          {errorUbicacion && <Notice tono="warning">{errorUbicacion}</Notice>}

          {puedeHaberMas && (
            <Notice tono="warning">
              La fuente entrega como mucho {numero(LIMITE_MAX)} reportes por consulta y hemos
              recibido justo ese tope, así que <strong>puede haber más sin mostrar</strong>. Su
              API no permite pedir la página siguiente.
            </Notice>
          )}
        </div>

        {consulta.error ? (
          <section className="section">
            <AvisoError
              error={consulta.error}
              origen="PR"
              alReintentar={() => consulta.refetch()}
            />
          </section>
        ) : (
          <>
            <section className="section">
              <div className="grid grid--kpi">
                <Kpi
                  etiqueta="Afectaciones"
                  valor={numero(enRadio.length)}
                  pista={origen ? `A menos de ${radioKm} km ${referencia}` : 'En toda la ciudad'}
                  icono={Construction}
                  cargando={cargando}
                />
                <Kpi
                  etiqueta="Riesgo alto"
                  valor={numero(altos)}
                  pista="Colapso, inclinación o grietas graves"
                  icono={TriangleAlert}
                  tono="critical"
                  cargando={cargando}
                  alPulsar={() => setSoloAlto((v) => !v)}
                  activo={soloAlto}
                />
                <Kpi
                  etiqueta="Vías afectadas"
                  valor={numero(vias)}
                  pista="Cerradas o con paso restringido"
                  icono={Route}
                  tono="warning"
                  cargando={cargando}
                  alPulsar={() => setTipo((t) => (t === 'via' ? 'todo' : 'via'))}
                  activo={tipo === 'via'}
                />
                <Kpi
                  etiqueta="Últimas 24 h"
                  valor={numero(recientes)}
                  pista="Reportado desde ayer"
                  icono={Clock}
                  cargando={cargando}
                  alPulsar={() => setSoloRecientes((v) => !v)}
                  activo={soloRecientes}
                />
              </div>
            </section>

            <section className="section">
              <SectionHead
                titulo="Qué hay alrededor"
                conteo={cargando ? undefined : `${numero(visibles.length)} en el mapa`}
              />

              <div className="chips" style={{ marginBottom: 'var(--sp-4)' }}>
                {FILTROS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="chip"
                    onClick={() => setTipo(f.id)}
                    aria-pressed={tipo === f.id}
                  >
                    <span>{f.etiqueta}</span>
                  </button>
                ))}
              </div>

              {/* El radio solo se ofrece cuando de verdad recorta algo. Sin
                  origen no hay distancias y un selector que no filtra nada es
                  una promesa falsa, igual que decirlo en el texto. */}
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

              {!origen && (
                <div className="stack">
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
                    Estás viendo <strong>Pereira entera</strong>: sin saber dónde estás no hay
                    distancias que calcular ni radio que aplicar.
                  </Notice>
                </div>
              )}

              {cargando ? (
                <div className="grid grid--cards">
                  <SkeletonTarjeta />
                  <SkeletonTarjeta />
                  <SkeletonTarjeta />
                </div>
              ) : visibles.length === 0 ? (
                <EmptyState
                  icono={Construction}
                  titulo={
                    enRadio.length === 0 && origen
                      ? 'No hay nada reportado a esta distancia'
                      : 'Ningún reporte cumple estos filtros'
                  }
                  texto={
                    enRadio.length === 0 && origen ? (
                      <>
                        Ojo con leer esto como "aquí no pasó nada":{' '}
                        <strong>esta fuente solo cubre Pereira</strong>. Si estás en otro
                        municipio, su silencio no dice nada sobre el tuyo.
                      </>
                    ) : (
                      'Prueba a quitar algún filtro o a ampliar el radio.'
                    )
                  }
                  acciones={
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => {
                        setTipo('todo')
                        setSoloAlto(false)
                        setSoloRecientes(false)
                        setRadioKm(30)
                      }}
                    >
                      <span>Quitar los filtros</span>
                    </button>
                  }
                />
              ) : (
                <>
                  {puntos.length > 0 && <MapaPuntos puntos={puntos} yoEstoyAqui={ubicacion} />}

                  {sinUbicar > 0 && (
                    <p
                      style={{
                        marginTop: 'var(--sp-3)',
                        color: 'var(--text-muted)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      {conteo(sinUbicar, 'reporte llegó', 'reportes llegaron')} sin coordenada
                      utilizable y no {sinUbicar === 1 ? 'aparece' : 'aparecen'} en el mapa;{' '}
                      {sinUbicar === 1 ? 'sigue' : 'siguen'} en la lista de abajo.
                    </p>
                  )}

                  <div className="grid grid--cards" style={{ marginTop: 'var(--sp-5)' }}>
                    {visibles.map((a) => (
                      <TarjetaAfectacion
                        key={a.id}
                        a={a}
                        conOrigen={!!origen}
                        alVerFotos={() => setFotosDe(a)}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>

      <SelectorCiudad abierto={selectorAbierto} alCerrar={() => setSelectorAbierto(false)} />
      <VisorFotos afectacion={fotosDe} alCerrar={() => setFotosDe(null)} />
    </>
  )
}

/* ------------------------------- La tarjeta -------------------------------- */

function TarjetaAfectacion({
  a,
  conOrigen,
  alVerFotos,
}: {
  a: AfectacionVista
  conOrigen: boolean
  alVerFotos: () => void
}) {
  return (
    <article className="card">
      <span className="card__accent" data-origen="pereira-responde" />
      <div className="card__body">
        <div className="row row--wrap" style={{ gap: 'var(--sp-2)' }}>
          <Badge tono={a.tipo === 'apoyo' ? 'success' : 'neutral'}>
            {TIPOS_AFECTACION[a.tipo].nombre}
          </Badge>
          {a.gravedad !== 'sin-clasificar' && (
            <Badge
              tono={a.gravedad === 'alta' ? 'critical' : 'warning'}
              icono={a.gravedad === 'alta' ? TriangleAlert : undefined}
            >
              {GRAVEDADES_AFECTACION[a.gravedad]}
            </Badge>
          )}
          {a.reciente && <Badge tono="info">Nuevo</Badge>}
          <div className="spacer" />
          <SelloFuente origen="pereira-responde" />
        </div>

        <h3 className="card__title clamp-2">{a.subtipo ?? a.titulo}</h3>

        {a.subtipo && (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            {a.titulo}
          </p>
        )}

        {a.nota && <p className="clamp-2" style={{ margin: 0 }}>{a.nota}</p>}

        <div
          className="row row--wrap"
          style={{ gap: 'var(--sp-3)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}
        >
          <span>{desde(a.reportadaEn)}</span>
          {/* La distancia solo se enseña cuando se ha podido calcular de verdad.
              Un "—" es honesto; un cero inventado manda a alguien a la esquina
              equivocada. */}
          {conOrigen && <span>{formatearDistancia(a.distanciaKm)}</span>}
          {a.confirmaciones > 0 && (
            <span className="row" style={{ gap: 4 }}>
              <ThumbsUp size={14} strokeWidth={2.2} />
              {conteo(a.confirmaciones, 'confirmación', 'confirmaciones')}
            </span>
          )}
        </div>
      </div>

      <div className="card__footer">
        {a.lat != null && a.lng != null ? (
          <ComoLlegar
            destino={{ lat: a.lat, lng: a.lng, nombre: a.titulo }}
            modo="ver"
            tamano="sm"
          />
        ) : (
          <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
            Sin ubicación
          </span>
        )}
        <div className="spacer" />
        {a.fotos.length > 0 && (
          <button type="button" className="btn btn--sm" onClick={alVerFotos}>
            <Camera size={15} strokeWidth={2.2} />
            <span>
              {a.fotos.length === 1 ? 'Ver la foto' : `Ver ${numero(a.fotos.length)} fotos`}
            </span>
          </button>
        )}
      </div>
    </article>
  )
}

/* -------------------------------- El visor --------------------------------- */

/**
 * Las fotos, una a una y solo bajo petición.
 *
 * Medidas contra la fuente: entre 3 y 7 MB por imagen, porque son el archivo
 * que salió de la cámara sin redimensionar. No hay miniatura que pedir. Cargar
 * la primera al abrir es razonable —para eso se pulsó—, pero se avisa del peso
 * antes de que alguien con datos contados se gaste la tarifa del mes, y las
 * siguientes se piden una a una.
 */
function VisorFotos({
  afectacion,
  alCerrar,
}: {
  afectacion: AfectacionVista | null
  alCerrar: () => void
}) {
  const [indice, setIndice] = useState(0)

  if (!afectacion) return null

  const total = afectacion.fotos.length
  const actual = afectacion.fotos[Math.min(indice, total - 1)]

  return (
    <Sheet
      abierta
      alCerrar={() => {
        setIndice(0)
        alCerrar()
      }}
      titulo={afectacion.titulo}
      subtitulo={`${TIPOS_AFECTACION[afectacion.tipo].nombre} · ${desde(afectacion.reportadaEn)}`}
    >
      <div className="stack">
        <Notice tono="info" icono={ImagenIcono}>
          La fuente publica las fotos tal como salen del teléfono, sin reducir:{' '}
          <strong>cada una pesa varios megas</strong>. Si vas con datos contados, quizá prefieras
          esperar a tener wifi.
        </Notice>

        <img
          src={actual}
          alt={`Evidencia de ${afectacion.titulo}`}
          loading="lazy"
          decoding="async"
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '58vh',
            objectFit: 'contain',
            borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border)',
            background: 'var(--surface-inset)',
          }}
        />

        {total > 1 && (
          <div className="chips">
            {afectacion.fotos.map((_, i) => (
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
      </div>
    </Sheet>
  )
}
