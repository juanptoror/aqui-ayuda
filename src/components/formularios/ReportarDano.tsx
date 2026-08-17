import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Camera, CircleCheck, LocateFixed, Trash2, TriangleAlert } from 'lucide-react'
import { Sheet, Notice } from '../ui'
import { Alternativa, Campo, CampoArea, CampoGrupo, QueFalta } from './Campos'
import {
  CATEGORIAS_APOYO,
  CLASES_POR_TIPO,
  exigeFoto,
  MAX_FOTOS,
  MAX_NOTA,
  SERVICIO_POR_CLASE,
  usePublicarAfectacion,
  type CategoriaApoyo,
} from '@/backends/pereira-responde/publicar'
import { publicarDanoServicio } from '@/backends/pereira-unida'
import {
  TIPOS_AFECTACION,
  type AlcanceServicio,
  type Coordenada,
  type TipoAfectacion,
} from '@/dominio/modelos'
import { FORMATOS_ACEPTADOS, pesoLegible, prepararFoto, type FotoPreparada } from '@/lib/imagenes'
import { obtenerUbicacion } from '@/lib/geo'
import { usePreferencias } from '@/state/preferencias'

/**
 * Reportar un daño desde aquí.
 *
 * Durante un tiempo esta aplicación solo sabía leer los reportes de Pereira
 * Responde y mandaba a la gente a su mapa para publicar. Ya no: su API abrió la
 * escritura, y el envío pasa por nuestra propia función de servidor porque la
 * clave no puede vivir en el navegador.
 *
 * Cinco decisiones que este formulario toma y conviene que estén escritas:
 *
 * 1. **El aviso de seguridad va arriba, no en la letra pequeña.** Quien rellena
 *    esto está delante de algo que se puede caer. La fuente pone el mismo aviso
 *    en su formulario y aquí no se rebaja.
 * 2. **El GPS centra el mapa; el pin lo pone la persona.** Publicar la posición
 *    del teléfono era publicar mal: reportar bien exige apartarse del edificio,
 *    y apartarse mueve el punto a la acera de enfrente o al portal del vecino.
 *    En un mapa de peligros eso manda a alguien a rodear la manzana equivocada.
 *    Así que el GPS es el punto de partida y el pin se arrastra al sitio exacto,
 *    igual que en el formulario de la propia fuente.
 * 3. **La foto se reduce antes de salir, y en un corte de servicio no se pide.**
 *    Una foto de teléfono pesa varios megas y quien reporta está con datos
 *    móviles en la calle: se manda una de unos 300 KB que enseña exactamente la
 *    misma grieta. Y en los cortes de luz, agua, gas o internet el contrato la
 *    deja opcional —no hay nada que fotografiar en un barrio a oscuras—, así
 *    que aquí tampoco se exige.
 * 4. **La clase de daño es un desplegable cerrado**, con las opciones de la
 *    propia fuente. Un título inventado deja el reporte fuera de sus filtros:
 *    lo vería quien mire la lista entera y nadie más.
 * 5. **Lo que falta se dice antes de pulsar.** Un botón apagado sin explicación
 *    es una pantalla que no contesta.
 * 6. **Un corte de servicio puede ir a dos sitios, y el segundo es una casilla.**
 *    Pereira Unida tiene un tablón que consultan las cuadrillas que reparan luz,
 *    agua, gas e internet: avisar ahí es la diferencia entre que alguien rodee
 *    el cable y que alguien venga a quitarlo. Va marcada por defecto porque no
 *    viaja ni un dato personal —ni nombre, ni teléfono, ni foto—, pero se ve y
 *    se puede quitar, porque publicar en una segunda organización no es una
 *    decisión que se tome por nadie. El envío es de mejor esfuerzo: si falla, el
 *    reporte principal ya está publicado y eso es lo que se cuenta.
 */

/**
 * `apoyo` decía "Servicio" a secas hasta que la fuente estrenó los cortes de
 * luz y agua, que en su vocabulario son "servicio público": dos pestañas
 * llamadas casi igual, una para una farmacia abierta y otra para un barrio a
 * oscuras. "Sitio abierto" nombra lo que de verdad es —un lugar que sigue
 * atendiendo— y deja la palabra "servicio" para lo que dejó de funcionar.
 */
const TIPOS: { valor: TipoAfectacion; texto: string }[] = [
  { valor: 'vivienda', texto: TIPOS_AFECTACION.vivienda.nombre },
  { valor: 'via', texto: TIPOS_AFECTACION.via.nombre },
  { valor: 'apoyo', texto: 'Sitio abierto' },
  { valor: 'servicio-publico', texto: TIPOS_AFECTACION['servicio-publico'].nombre },
]

/** Lo que expone `MapaElegirPunto`, para poder cargarlo con `import()`. */
type CapaMapa = ComponentType<{
  punto: Coordenada | null
  alElegir: (c: Coordenada) => void
  tema: 'light' | 'dark'
}>

export function ReportarDano({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const { tema } = usePreferencias()
  const [tipo, setTipo] = useState<TipoAfectacion>('vivienda')
  const [clase, setClase] = useState('')
  const [gravedad, setGravedad] = useState<'alta' | 'media'>('alta')
  const [categoria, setCategoria] = useState<CategoriaApoyo | ''>('')
  const [nota, setNota] = useState('')
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(null)
  const [buscandoPunto, setBuscandoPunto] = useState(false)
  const [errorPunto, setErrorPunto] = useState<string | null>(null)
  const [fotos, setFotos] = useState<FotoPreparada[]>([])
  const [preparandoFoto, setPreparandoFoto] = useState(false)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)
  const [creado, setCreado] = useState(false)

  /* Mandar el daño también al tablón de cuadrillas de Pereira Unida. Marcada
     por defecto: aquí no viaja ni un dato personal —ni nombre, ni teléfono, ni
     foto—, solo qué se rompió y dónde, y al otro lado lo recibe quien puede ir
     a arreglarlo. Aun así es una casilla y no una decisión nuestra: se publica
     en una segunda organización y eso se ve y se puede quitar. */
  const [tambienCuadrillas, setTambienCuadrillas] = useState(true)
  /* Qué alcance tiene el corte. Es la única cosa que esa fuente necesita y esta
     no pregunta; deducirla sería inventarla. */
  const [alcance, setAlcance] = useState<AlcanceServicio>('sector')
  /* El segundo envío es de mejor esfuerzo: si falla, el reporte YA está
     publicado en Pereira Responde y eso es lo que hay que contar. */
  const [falloCuadrillas, setFalloCuadrillas] = useState(false)

  const entradaFoto = useRef<HTMLInputElement>(null)
  const publicar = usePublicarAfectacion()

  /* Leaflet pesa lo que pesa y solo hace falta aquí dentro, así que baja cuando
     se abre la hoja y no antes. Si no llega —red caída, CDN bloqueado— el
     formulario sigue sirviendo con el punto del GPS: se avisa de que no se
     puede afinar, en vez de dejar un hueco gris y un campo obligatorio
     imposible de rellenar. */
  const [Mapa, setMapa] = useState<CapaMapa | null>(null)
  const [sinMapa, setSinMapa] = useState(false)

  useEffect(() => {
    if (!abierto || Mapa || sinMapa) return
    let vivo = true
    import('../MapaElegirPunto')
      .then((m) => {
        if (vivo) setMapa(() => m.MapaElegirPunto)
      })
      .catch(() => {
        if (vivo) setSinMapa(true)
      })
    return () => {
      vivo = false
    }
  }, [abierto, Mapa, sinMapa])

  const clases = CLASES_POR_TIPO[tipo]

  function cambiarTipo(t: TipoAfectacion) {
    setTipo(t)
    // La clase pertenece al tipo: conservarla dejaría "Colapso total" en una vía.
    setClase('')
    if (t !== 'apoyo') setCategoria('')
  }

  function limpiar() {
    for (const f of fotos) URL.revokeObjectURL(f.vistaPrevia)
    setTipo('vivienda')
    setClase('')
    setGravedad('alta')
    setCategoria('')
    setNota('')
    setPunto(null)
    setErrorPunto(null)
    setFotos([])
    setErrorFoto(null)
    setCreado(false)
    setTambienCuadrillas(true)
    setAlcance('sector')
    setFalloCuadrillas(false)
    publicar.reset()
  }

  function cerrar() {
    limpiar()
    alCerrar()
  }

  async function marcarDondeEstoy() {
    setBuscandoPunto(true)
    setErrorPunto(null)
    try {
      // Alta precisión y sin caché: aquí importa el edificio, no el barrio.
      setPunto(await obtenerUbicacion(15_000, true))
    } catch (e) {
      setErrorPunto(e instanceof Error ? e.message : 'No se pudo obtener tu ubicación.')
    } finally {
      setBuscandoPunto(false)
    }
  }

  async function anadirFotos(archivos: FileList | null) {
    if (!archivos || archivos.length === 0) return
    setErrorFoto(null)
    setPreparandoFoto(true)
    try {
      const hueco = MAX_FOTOS - fotos.length
      const nuevas: FotoPreparada[] = []
      for (const archivo of Array.from(archivos).slice(0, hueco)) {
        nuevas.push(await prepararFoto(archivo))
      }
      setFotos((previas) => [...previas, ...nuevas])
      if (archivos.length > hueco) {
        setErrorFoto(`Solo caben ${MAX_FOTOS} fotos: las demás no se añadieron.`)
      }
    } catch (e) {
      setErrorFoto(e instanceof Error ? e.message : 'No se pudo preparar la foto.')
    } finally {
      setPreparandoFoto(false)
      if (entradaFoto.current) entradaFoto.current.value = ''
    }
  }

  function quitarFoto(i: number) {
    setFotos((previas) => {
      URL.revokeObjectURL(previas[i].vistaPrevia)
      return previas.filter((_, j) => j !== i)
    })
  }

  /* La foto es obligatoria en todo menos en los cortes de servicio: el contrato
     la deja opcional ahí, y con razón —no hay nada que fotografiar en un barrio
     a oscuras—. Pedirla igual dejaría sin publicar justo a quien no puede
     enseñar nada. */
  const fotoObligatoria = exigeFoto(tipo)

  const faltan: string[] = []
  if (!clase) faltan.push('la clase de afectación')
  if (tipo === 'apoyo' && !categoria) faltan.push('qué servicio es')
  if (!punto) faltan.push('la ubicación')
  if (fotoObligatoria && fotos.length === 0) faltan.push('una foto')

  const listo = faltan.length === 0 && !publicar.isPending && !preparandoFoto
  const pesoTotal = fotos.reduce((s, f) => s + f.bytes, 0)

  /* Solo los cortes de servicio tienen dónde replicarse: el tablón de cuadrillas
     recibe daños de luz, agua, gas, internet y postes, no edificios ni vías. */
  const servicio = tipo === 'servicio-publico' ? SERVICIO_POR_CLASE[clase] : undefined
  const puedeReplicar = !!servicio
  /* Un poste o un cable caído ya ES el peligro crítico de su escala: preguntar
     "¿a cuánta gente afecta?" ahí no tiene respuesta útil. */
  const preguntarAlcance = puedeReplicar && servicio !== 'poste-cable'

  async function enviar() {
    if (!listo || !punto) return

    try {
      await publicar.mutateAsync({
        tipo,
        gravedad,
        clase,
        categoria: tipo === 'apoyo' ? (categoria as CategoriaApoyo) : null,
        nota,
        lat: punto.lat,
        lng: punto.lng,
        fotos,
      })
    } catch {
      /* el error se muestra desde publicar.error */
      return
    }

    /* Segundo envío, de mejor esfuerzo y DESPUÉS del principal. En su propio
       `try`: si falla, el daño ya está publicado en Pereira Responde, y decir
       "no se pudo" mandaría a alguien a rellenarlo otra vez desde la calle. */
    if (tambienCuadrillas && servicio) {
      try {
        await publicarDanoServicio({
          servicio,
          alcance,
          nota,
          lat: punto.lat,
          lng: punto.lng,
        })
      } catch (err) {
        setFalloCuadrillas(true)
        console.error('[AquíAyuda] no se pudo replicar en Pereira Unida', err)
      }
    }

    setCreado(true)
  }

  /* ------------------------------ Ya publicado ---------------------------- */

  if (creado) {
    return (
      <Sheet
        abierta={abierto}
        alCerrar={cerrar}
        titulo="Reporte publicado"
        pie={
          <>
            <button type="button" className="btn" onClick={limpiar}>
              <span>Reportar otro</span>
            </button>
            <button type="button" className="btn btn--primary" onClick={cerrar}>
              <span>Listo</span>
            </button>
          </>
        }
      >
        <div className="stack">
          <Notice tono="info" icono={CircleCheck}>
            Ya está en el mapa de Pereira Responde y en el de esta aplicación.{' '}
            <strong>Queda sujeto a moderación y a los votos de la comunidad</strong>, igual que
            cualquier reporte hecho desde su web: si alguien confirma que sigue así, sube.
          </Notice>

          {/* Solo se menciona el segundo destino cuando de verdad hubo uno. */}
          {tambienCuadrillas && puedeReplicar && !falloCuadrillas && (
            <Notice tono="info">
              También se envió al <strong>tablón de cuadrillas de Pereira Unida</strong>, donde lo
              ven los equipos que atienden cortes de luz, agua, gas e internet. Allí viajó el punto
              y qué se rompió; la foto se queda en Pereira Responde.
            </Notice>
          )}

          {falloCuadrillas && (
            <Notice tono="warning">
              Solo pudimos publicarlo en <strong>Pereira Responde</strong>: el tablón de cuadrillas
              de Pereira Unida no aceptó la copia. Tu reporte está publicado igualmente y se ve
              desde esta aplicación.
            </Notice>
          )}

          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Aléjate del sitio si no lo has hecho ya. Si hay gente en peligro, llama al{' '}
            <strong>123</strong>: publicar un reporte no avisa a nadie.
          </p>
        </div>
      </Sheet>
    )
  }

  /* -------------------------------- El formulario -------------------------- */

  return (
    <Sheet
      abierta={abierto}
      alCerrar={cerrar}
      titulo="Reportar un daño"
      subtitulo="Se publica en Pereira Responde, la fuente que alimenta esta pantalla"
      pie={
        <>
          <button type="button" className="btn" onClick={cerrar}>
            <span>Cancelar</span>
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void enviar()}
            disabled={!listo}
          >
            <span>{publicar.isPending ? 'Publicando…' : 'Publicar el reporte'}</span>
          </button>
        </>
      }
    >
      <div className="stack">
        <Notice tono="critical">
          <strong>No te acerques a comprobarlo.</strong> Reporta desde un lugar seguro, y si hay
          peligro inmediato llama al <strong>123</strong> antes que nada: esto no avisa a nadie.
        </Notice>

        <Alternativa etiqueta="Qué es" opciones={TIPOS} valor={tipo} alElegir={cambiarTipo} />

        <Campo id="clase" etiqueta="Qué le pasa" obligatorio>
          <select
            id="clase"
            className="select"
            value={clase}
            onChange={(e) => setClase(e.target.value)}
          >
            <option value="">Elige una opción</option>
            {clases.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Campo>

        {/* La gravedad solo existe en los edificios. En vías y servicios la
            fuente repite el tipo dentro del campo de riesgo, así que ofrecer
            aquí un selector sería inventar un dato que no va a ninguna parte. */}
        {tipo === 'vivienda' && (
          <Alternativa
            etiqueta="Cómo de grave"
            opciones={[
              { valor: 'alta' as const, texto: 'Riesgo alto' },
              { valor: 'media' as const, texto: 'Riesgo medio' },
            ]}
            valor={gravedad}
            alElegir={setGravedad}
          />
        )}

        {tipo === 'apoyo' && (
          <Campo id="categoria" etiqueta="Qué servicio es" obligatorio>
            <select
              id="categoria"
              className="select"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaApoyo)}
            >
              <option value="">Elige una opción</option>
              {CATEGORIAS_APOYO.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.texto}
                </option>
              ))}
            </select>
          </Campo>
        )}

        <CampoArea
          id="nota"
          etiqueta="Nota"
          valor={nota}
          alCambiar={setNota}
          maximo={MAX_NOTA}
          marcador="Ej. hay paso restringido o personas evacuadas"
          ayuda="Opcional. Lo que no se ve en la foto: si hay gente evacuada, si el paso está cortado, qué calle es."
        />

        {/* ------------------------------ Ubicación --------------------------- */}
        <CampoGrupo
          etiqueta="Dónde está"
          obligatorio
          ayuda={
            sinMapa
              ? 'No se pudo cargar el mapa, así que se publicará el punto del GPS. Si te apartaste del sitio, el aviso saldrá algo desplazado.'
              : 'Tu ubicación centra el mapa; el pin lo pones tú. Muévelo al edificio o al tramo exacto: quien lea el aviso va a fiarse de ese punto para saber por dónde no pasar.'
          }
        >
          <div className="row row--wrap" style={{ gap: 'var(--sp-3)' }}>
            <button
              type="button"
              className="btn"
              onClick={marcarDondeEstoy}
              disabled={buscandoPunto}
            >
              <LocateFixed size={17} />
              <span>{buscandoPunto ? 'Buscando…' : 'Centrar donde estoy'}</span>
            </button>
            {punto && (
              <span className="num" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                {punto.lat.toFixed(5)}, {punto.lng.toFixed(5)}
              </span>
            )}
          </div>

          {Mapa && (
            <div style={{ marginTop: 'var(--sp-3)' }}>
              <Mapa punto={punto} alElegir={setPunto} tema={tema} />
            </div>
          )}
        </CampoGrupo>

        {errorPunto && <Notice tono="warning">{errorPunto}</Notice>}

        {/* -------------------------------- Fotos ----------------------------- */}
        <CampoGrupo
          etiqueta={`Foto${fotos.length > 1 ? 's' : ''}`}
          obligatorio={fotoObligatoria}
          ayuda={
            fotos.length > 0
              ? `Se envían reducidas: ${pesoLegible(pesoTotal)} en total en vez de varios megas.`
              : fotoObligatoria
                ? `Hace falta al menos una y caben ${MAX_FOTOS}. Se reducen antes de subirlas para que no te cueste medio plan de datos.`
                : `Opcional aquí: un corte de luz o de agua no se ve en una foto. Si hay un poste o un cable caído, una foto ayuda a que lo confirmen; caben ${MAX_FOTOS}.`
          }
        >
          <div className="row row--wrap" style={{ gap: 'var(--sp-3)' }}>
            <button
              type="button"
              className="btn"
              onClick={() => entradaFoto.current?.click()}
              disabled={preparandoFoto || fotos.length >= MAX_FOTOS}
            >
              <Camera size={17} />
              <span>
                {preparandoFoto
                  ? 'Preparando…'
                  : fotos.length === 0
                    ? 'Tomar o elegir foto'
                    : 'Añadir otra'}
              </span>
            </button>
            <input
              ref={entradaFoto}
              type="file"
              accept={FORMATOS_ACEPTADOS}
              capture="environment"
              multiple
              hidden
              onChange={(e) => void anadirFotos(e.target.files)}
            />
          </div>

          {fotos.length > 0 && (
            <div className="row row--wrap" style={{ gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
              {fotos.map((f, i) => (
                <figure
                  key={f.vistaPrevia}
                  style={{
                    margin: 0,
                    position: 'relative',
                    width: 108,
                    borderRadius: 'var(--r-md)',
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                  }}
                >
                  <img
                    src={f.vistaPrevia}
                    alt={`Foto ${i + 1}`}
                    style={{ display: 'block', width: '100%', height: 84, objectFit: 'cover' }}
                  />
                  <figcaption
                    style={{
                      fontSize: 'var(--text-micro)',
                      color: 'var(--text-muted)',
                      padding: '2px 6px',
                    }}
                  >
                    {pesoLegible(f.bytes)}
                  </figcaption>
                  <button
                    type="button"
                    className="btn btn--sm btn--icon"
                    onClick={() => quitarFoto(i)}
                    aria-label={`Quitar la foto ${i + 1}`}
                    style={{ position: 'absolute', top: 4, right: 4 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </figure>
              ))}
            </div>
          )}
        </CampoGrupo>

        {errorFoto && <Notice tono="warning">{errorFoto}</Notice>}

        {/* --------------------- El segundo destino ---------------------- */}
        {puedeReplicar && (
          <div className="stack">
            <label
              className="panel panel--inset"
              style={{
                display: 'flex',
                gap: 'var(--sp-3)',
                padding: 'var(--sp-4)',
                cursor: 'pointer',
                alignItems: 'flex-start',
              }}
            >
              <input
                type="checkbox"
                checked={tambienCuadrillas}
                onChange={(e) => setTambienCuadrillas(e.target.checked)}
                style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0, cursor: 'pointer' }}
              />
              <span className="min0">
                <span style={{ display: 'block', fontWeight: 650, marginBottom: 2 }}>
                  Avisar también a las cuadrillas de Pereira Unida
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  Su tablón lo consultan los equipos que reparan luz, agua, gas e internet. Se
                  envía qué se rompió y el punto exacto: <strong>ni tu nombre, ni tu teléfono, ni
                  la foto</strong>.
                </span>
              </span>
            </label>

            {/* La única pregunta que esa fuente necesita y esta no hace. Solo
                aparece si de verdad se va a mandar: preguntar por algo que no
                va a ninguna parte es hacer perder el tiempo en la calle. */}
            {tambienCuadrillas && preguntarAlcance && (
              <Alternativa
                etiqueta="A cuánta gente afecta"
                opciones={[
                  { valor: 'sector' as const, texto: 'Todo el sector' },
                  { valor: 'vivienda' as const, texto: 'Solo una vivienda' },
                ]}
                valor={alcance}
                alElegir={setAlcance}
              />
            )}
          </div>
        )}

        {publicar.error && (
          <Notice tono="critical" icono={TriangleAlert}>
            {publicar.error instanceof Error
              ? publicar.error.message
              : 'No se pudo publicar el reporte.'}
          </Notice>
        )}

        <QueFalta faltan={faltan} />

        <p style={{ margin: 0, color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
          Al publicar, la foto y el punto quedan visibles para cualquiera en Pereira Responde. No
          se envía tu nombre ni tu teléfono; el reporte pasa por su moderación y por los votos de
          la comunidad.
        </p>
      </div>
    </Sheet>
  )
}
