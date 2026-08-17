import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LocateFixed, Maximize, Minus, Plus } from 'lucide-react'
import { formaDe, type PropsCapaMapa, type PuntoMapa } from './MapaPuntos'

/**
 * El mapa real: calles, manzanas y nombres de barrio sobre datos de
 * OpenStreetMap.
 *
 * Se carga aparte del resto de la aplicación (`import()` dinámico desde
 * MapaPuntos) porque Leaflet más su hoja de estilos pesan lo que pesa media
 * pantalla, y quien entra a la portada a mirar un teléfono de emergencia no
 * tiene por qué descargarlo. Debajo de esta capa sigue viva la de posiciones
 * dibujada en el dispositivo: si los tiles no llegan, esto se retira y queda
 * aquélla. Nunca hay un rectángulo gris.
 *
 * ¿Por qué CARTO y no los tiles de openstreetmap.org? Los datos son los mismos
 * —OSM— pero el render de osm.org es el clásico de wiki: marrón, tipografía
 * apretada y, sobre todo, su política de uso pide expresamente no montar
 * aplicaciones encima. El "Voyager" de CARTO es OSM pintado como un mapa
 * moderno (vías blancas, parques verdes, agua clara), es gratuito y no pide
 * clave ni tarjeta. La atribución de las dos partes es obligatoria y va abajo
 * a la izquierda; no se toca.
 */

const TESELAS = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
} as const

const ATRIBUCION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · ' +
  '<a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>'

/** Sin un tile en pie tras esto, damos la red por perdida y volvemos al esquema. */
const ESPERA_MAXIMA_MS = 7000

/** Centro del Eje Cafetero: sitio donde caer mientras se calcula el encuadre. */
const CENTRO_POR_DEFECTO: L.LatLngExpression = [4.8133, -75.6961]

interface Props extends PropsCapaMapa {
  tema: 'light' | 'dark'
  /** Primer tile pintado: el contenedor funde esta capa sobre el esquema. */
  alEstarListo: () => void
  /** Los tiles no llegan. El contenedor nos desmonta y se queda con el esquema. */
  alFallar: () => void
}

/**
 * Cuadrado para un sitio fijo, círculo lima para una persona, círculo rojo con
 * anillo para un daño.
 *
 * El criterio sale de `formaDe`, el mismo que usa el esquema, para que cambiar
 * de capa a mitad de carga no cambie lo que significan las cosas. El anillo del
 * punto rojo lo dibuja el CSS con una sombra interior: no hace falta un
 * elemento hijo y así el punto entero sigue siendo la zona de toque.
 */
function iconoDe(p: PuntoMapa, activo: boolean): L.DivIcon {
  const forma = formaDe(p)
  const clases = ['mapa__punto', `mapa__punto--${forma}`]
  if (p.destacado) clases.push('is-destacado')
  if (activo) clases.push('is-activo')

  const lado = (p.destacado ? 21 : 17) + (activo ? 5 : 0)
  return L.divIcon({
    className: clases.join(' '),
    iconSize: [lado, lado],
    iconAnchor: [lado / 2, lado / 2],
    html: '',
  })
}

const ICONO_YO = L.divIcon({
  className: 'mapa__yo',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: '<span class="mapa__yo-halo"></span><span class="mapa__yo-punto"></span>',
})

export function MapaTiles({
  puntos,
  yoEstoyAqui,
  activo,
  alActivar,
  tema,
  alEstarListo,
  alFallar,
}: Props) {
  const cajaRef = useRef<HTMLDivElement | null>(null)
  const mapaRef = useRef<L.Map | null>(null)
  const capaRef = useRef<L.TileLayer | null>(null)
  const grupoRef = useRef<L.LayerGroup | null>(null)
  const marcadoresRef = useRef(new Map<string, { m: L.Marker; p: PuntoMapa }>())
  const yoRef = useRef<L.Marker | null>(null)
  const activoRef = useRef<string | null>(activo)

  /* Mientras nadie haya tocado el mapa, el encuadre se recalcula solo: Corag
     responde tarde y sus puntos deben caber. En cuanto alguien arrastra o hace
     zoom dejamos de moverle la vista bajo los dedos. */
  const tocadoRef = useRef(false)
  const encuadreRef = useRef('')

  const [listo, setListo] = useState(false)
  const [pista, setPista] = useState<string | null>(null)
  const relojPistaRef = useRef<number | undefined>(undefined)

  // Las funciones del padre cambian en cada render; el mapa se monta una vez.
  const cbRef = useRef({ alActivar, alEstarListo, alFallar })
  useEffect(() => {
    cbRef.current = { alActivar, alEstarListo, alFallar }
  })

  const mostrarPista = useCallback((texto: string) => {
    setPista(texto)
    window.clearTimeout(relojPistaRef.current)
    relojPistaRef.current = window.setTimeout(() => setPista(null), 2200)
  }, [])

  // ---------------------------------------------------------------- montaje
  useEffect(() => {
    const caja = cajaRef.current
    if (!caja) return

    const mapa = L.map(caja, {
      center: CENTRO_POR_DEFECTO,
      zoom: 12,
      minZoom: 3,
      maxZoom: 19,
      zoomControl: false,
      /* La rueda pide Ctrl y el dedo pide dos dedos. Un mapa dentro de una
         página que se traga el scroll es la forma más rápida de que alguien
         no llegue al listado que hay debajo. */
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
    })
    // La atribución de OSM y CARTO es obligatoria; se mueve a la izquierda
    // porque a la derecha están nuestros mandos.
    mapa.attributionControl.setPrefix(false)
    mapa.attributionControl.setPosition('bottomleft')
    mapaRef.current = mapa
    grupoRef.current = L.layerGroup().addTo(mapa)

    const capa = L.tileLayer(TESELAS[tema], {
      attribution: ATRIBUCION,
      subdomains: 'abcd',
      maxZoom: 19,
      /* Sin esto, al alejar mucho el mapa se ve el mundo repetido y los puntos
         solo aparecen en una de las copias. */
      noWrap: true,
    })
    capaRef.current = capa

    let cargados = 0
    let fallos = 0
    capa.on('tileload', () => {
      cargados += 1
      if (cargados === 1) {
        setListo(true)
        cbRef.current.alEstarListo()
      }
    })
    /* Tres fallos sin un solo acierto no es un tile perdido: es que no hay red
       o el CDN está caído. Se avisa una vez y el contenedor decide. */
    capa.on('tileerror', () => {
      fallos += 1
      if (cargados === 0 && fallos >= 3) cbRef.current.alFallar()
    })
    capa.addTo(mapa)

    const reloj = window.setTimeout(() => {
      if (cargados === 0) cbRef.current.alFallar()
    }, ESPERA_MAXIMA_MS)

    mapa.on('dragstart', () => {
      tocadoRef.current = true
    })

    const alRodar = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        tocadoRef.current = true
        const bajoElCursor = mapa.containerPointToLatLng(mapa.mouseEventToContainerPoint(e))
        mapa.setZoomAround(bajoElCursor, mapa.getZoom() + (e.deltaY < 0 ? 1 : -1))
      } else {
        mostrarPista('Mantén Ctrl y gira la rueda para acercar')
      }
    }

    /* Con `dragging` desactivado Leaflet quita su propio `touch-action`, así
       que un dedo scrollea la página como en cualquier otro sitio. Dos dedos
       activan el arrastre y el pellizco a la vez. */
    const alCambiarDedos = (e: TouchEvent) => {
      if (!L.Browser.mobile) return
      if (e.touches.length >= 2) mapa.dragging.enable()
      else mapa.dragging.disable()
    }
    const alMoverUnDedo = (e: TouchEvent) => {
      if (L.Browser.mobile && e.touches.length < 2) mostrarPista('Mueve el mapa con dos dedos')
    }

    caja.addEventListener('wheel', alRodar, { passive: false })
    caja.addEventListener('touchstart', alCambiarDedos, { passive: true })
    caja.addEventListener('touchend', alCambiarDedos, { passive: true })
    caja.addEventListener('touchmove', alMoverUnDedo, { passive: true })

    /* El mapa de /vivienda nace dentro de una pestaña oculta y el de /mapa
       cambia de alto al rotar el teléfono. Sin esto quedan tiles a medias. */
    const observador = new ResizeObserver(() => mapa.invalidateSize({ animate: false }))
    observador.observe(caja)

    return () => {
      window.clearTimeout(reloj)
      window.clearTimeout(relojPistaRef.current)
      observador.disconnect()
      caja.removeEventListener('wheel', alRodar)
      caja.removeEventListener('touchstart', alCambiarDedos)
      caja.removeEventListener('touchend', alCambiarDedos)
      caja.removeEventListener('touchmove', alMoverUnDedo)
      mapa.remove()
      mapaRef.current = null
      capaRef.current = null
      grupoRef.current = null
      yoRef.current = null
      marcadoresRef.current.clear()
    }
    // El mapa se crea una sola vez. El tema y los puntos se aplican encima.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------------------------------------------------------------------- tema
  useEffect(() => {
    capaRef.current?.setUrl(TESELAS[tema])
  }, [tema])

  // --------------------------------------------------------------- selección
  useEffect(() => {
    const previo = activoRef.current
    activoRef.current = activo
    for (const id of [previo, activo]) {
      if (!id) continue
      const ficha = marcadoresRef.current.get(id)
      ficha?.m.setIcon(iconoDe(ficha.p, id === activo))
    }
  }, [activo])

  // ---------------------------------------------------------------- marcadores
  useEffect(() => {
    const mapa = mapaRef.current
    const grupo = grupoRef.current
    if (!mapa || !grupo) return

    grupo.clearLayers()
    marcadoresRef.current.clear()

    for (const p of puntos) {
      const m = L.marker([p.lat, p.lng], {
        icon: iconoDe(p, p.id === activoRef.current),
        title: p.titulo,
        keyboard: true,
        riseOnHover: true,
        // Lo urgente se dibuja encima de lo demás cuando se solapan.
        zIndexOffset: p.destacado ? 400 : 0,
      })
      m.on('click', () => cbRef.current.alActivar(p.id))
      // El puntero sobre un punto ya rellena la ficha de abajo; en táctil no
      // existe ese gesto y el toque hace lo mismo.
      if (!L.Browser.mobile) m.on('mouseover', () => cbRef.current.alActivar(p.id))
      m.addTo(grupo)
      m.getElement()?.setAttribute('aria-label', p.titulo)
      marcadoresRef.current.set(p.id, { m, p })
    }

    if (yoRef.current) {
      yoRef.current.remove()
      yoRef.current = null
    }
    if (yoEstoyAqui) {
      yoRef.current = L.marker([yoEstoyAqui.lat, yoEstoyAqui.lng], {
        icon: ICONO_YO,
        interactive: false,
        keyboard: false,
        zIndexOffset: 500,
      }).addTo(grupo)
    }

    const firma = puntos.map((p) => p.id).join('|') + (yoEstoyAqui ? '|yo' : '')
    if (firma !== encuadreRef.current && !tocadoRef.current) {
      encuadreRef.current = firma
      const coords: L.LatLngExpression[] = puntos.map((p) => [p.lat, p.lng])
      if (yoEstoyAqui) coords.push([yoEstoyAqui.lat, yoEstoyAqui.lng])
      if (coords.length > 0) {
        mapa.fitBounds(L.latLngBounds(coords), {
          padding: [42, 42],
          // Con un solo punto el encuadre se iría a la escala de la acera y no
          // se entendería dónde está eso.
          maxZoom: 16,
          animate: false,
        })
      }
    }
  }, [puntos, yoEstoyAqui])

  // ------------------------------------------------------------------ mandos
  const zoom = useCallback((delta: number) => {
    tocadoRef.current = true
    mapaRef.current?.setZoom((mapaRef.current?.getZoom() ?? 12) + delta)
  }, [])

  const encuadrarTodo = useCallback(() => {
    const mapa = mapaRef.current
    if (!mapa) return
    const coords: L.LatLngExpression[] = puntos.map((p) => [p.lat, p.lng])
    if (yoEstoyAqui) coords.push([yoEstoyAqui.lat, yoEstoyAqui.lng])
    if (coords.length === 0) return
    // Volver a encuadrar es también decir "sigue tú": el mapa recupera el
    // derecho a reencuadrarse cuando lleguen puntos de la fuente lenta.
    tocadoRef.current = false
    mapa.fitBounds(L.latLngBounds(coords), { padding: [42, 42], maxZoom: 16 })
  }, [puntos, yoEstoyAqui])

  const centrarEnMi = useCallback(() => {
    if (!yoEstoyAqui) return
    tocadoRef.current = true
    mapaRef.current?.setView([yoEstoyAqui.lat, yoEstoyAqui.lng], 15)
  }, [yoEstoyAqui])

  return (
    <div className={`mapa__capa mapa__capa--tiles${listo ? ' is-visible' : ''}`}>
      <div ref={cajaRef} className="mapa__lienzo" />

      <div className="mapa__controles">
        <div className="mapa__botonera">
          <button type="button" className="mapa__ctrl" onClick={() => zoom(1)} aria-label="Acercar">
            <Plus size={17} strokeWidth={2.4} />
          </button>
          <button type="button" className="mapa__ctrl" onClick={() => zoom(-1)} aria-label="Alejar">
            <Minus size={17} strokeWidth={2.4} />
          </button>
        </div>
        <div className="mapa__botonera">
          <button
            type="button"
            className="mapa__ctrl"
            onClick={encuadrarTodo}
            aria-label="Ver todos los puntos"
            title="Ver todos los puntos"
          >
            <Maximize size={16} strokeWidth={2.2} />
          </button>
          {yoEstoyAqui && (
            <button
              type="button"
              className="mapa__ctrl"
              onClick={centrarEnMi}
              aria-label="Centrar en mi ubicación"
              title="Centrar en mi ubicación"
            >
              <LocateFixed size={16} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>

      {pista && (
        <div className="mapa__pista" role="status">
          {pista}
        </div>
      )}
    </div>
  )
}
