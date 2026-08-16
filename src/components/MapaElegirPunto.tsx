import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coordenada } from '@/dominio/modelos'

/**
 * El mapa donde se señala DÓNDE está el daño.
 *
 * Existe porque el GPS no basta. Reportar bien exige apartarse del edificio, y
 * apartarse mueve el punto: se publicaba la acera de enfrente, la esquina, o el
 * portal del vecino. Para un mapa de peligros eso no es un detalle estético —
 * quien lo lea rodeará la manzana equivocada, o volverá a dormir a la casa que
 * de verdad está tocada.
 *
 * Así que el GPS deja de ser la respuesta y pasa a ser el punto de partida:
 * centra el mapa donde estás y desde ahí se arrastra el pin al edificio o al
 * tramo de vía exacto. Es lo mismo que hace el formulario de la propia fuente.
 *
 * Va en un fichero aparte y se carga con `import()` por el mismo motivo que
 * `MapaTiles`: Leaflet y su hoja de estilos pesan lo que pesan, y quien nunca
 * abre el formulario de reporte no tiene por qué descargarlos. Comparten el
 * mismo chunk, así que si ya se vio un mapa, esto no cuesta nada.
 */

const TESELAS = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
} as const

const ATRIBUCION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · ' +
  '<a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>'

/** Pereira, que es lo único que cubre la fuente. */
const CENTRO_POR_DEFECTO: L.LatLngExpression = [4.8133, -75.6961]

/**
 * Zoom de calle, no de ciudad.
 *
 * A zoom 13 se ven barrios enteros y el pin cae "en algún sitio por ahí", que
 * es exactamente el problema que este mapa viene a resolver. A 18 se distinguen
 * los portales.
 */
const ZOOM_ELEGIR = 18

const PIN = L.divIcon({
  className: 'mapa__pin-elegir',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  html: '<i></i>',
})

export function MapaElegirPunto({
  punto,
  alElegir,
  tema,
}: {
  punto: Coordenada | null
  alElegir: (c: Coordenada) => void
  tema: 'light' | 'dark'
}) {
  const caja = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const marca = useRef<L.Marker | null>(null)

  /* `alElegir` llega como función inline y cambia en cada render del padre. En
     una ref, los manejadores de Leaflet —que se montan una sola vez— siempre
     llaman a la última versión sin tener que remontar el mapa entero. */
  const alElegirRef = useRef(alElegir)
  useEffect(() => {
    alElegirRef.current = alElegir
  })

  useEffect(() => {
    if (!caja.current || mapa.current) return

    const m = L.map(caja.current, {
      center: punto ? [punto.lat, punto.lng] : CENTRO_POR_DEFECTO,
      zoom: punto ? ZOOM_ELEGIR : 14,
      zoomControl: false,
      attributionControl: true,
    })
    L.tileLayer(TESELAS[tema], { attribution: ATRIBUCION, maxZoom: 19 }).addTo(m)
    L.control.zoom({ position: 'bottomright' }).addTo(m)

    const mover = (c: L.LatLng) => alElegirRef.current({ lat: c.lat, lng: c.lng })

    // Tocar el mapa mueve el pin. Es el gesto que ya espera cualquiera.
    m.on('click', (e: L.LeafletMouseEvent) => mover(e.latlng))

    mapa.current = m

    /* El mapa nace dentro de una hoja que entra animada, así que en el primer
       fotograma su contenedor mide cero y Leaflet calcula mal las teselas: sale
       un cuadro gris con un trozo de mapa en la esquina. `invalidateSize` tras
       el montaje le hace medir otra vez, ya con la hoja quieta. */
    const t = window.setTimeout(() => m.invalidateSize(), 260)

    return () => {
      window.clearTimeout(t)
      m.remove()
      mapa.current = null
      marca.current = null
    }
    // Solo al montar: el tema y el punto se sincronizan en sus propios efectos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* El pin sigue al punto venga de donde venga: de un toque en el mapa, de un
     arrastre o del botón de ubicación. Una sola fuente de verdad. */
  useEffect(() => {
    const m = mapa.current
    if (!m) return

    if (!punto) {
      marca.current?.remove()
      marca.current = null
      return
    }

    const donde = L.latLng(punto.lat, punto.lng)
    const primeraVez = !marca.current

    if (primeraVez) {
      marca.current = L.marker(donde, { icon: PIN, draggable: true, autoPan: true })
        .on('dragend', (e) => {
          const c = (e.target as L.Marker).getLatLng()
          alElegirRef.current({ lat: c.lat, lng: c.lng })
        })
        .addTo(m)
    } else {
      marca.current!.setLatLng(donde)
    }

    if (primeraVez) {
      /* Al colocar el primer pin se baja a nivel de calle SIEMPRE. Con el zoom
         de ciudad con el que nace el mapa se ve el barrio entero y el pin cae
         "por ahí", que es exactamente el problema que este mapa viene a
         resolver: a 18 se distinguen los portales. */
      m.setView(donde, ZOOM_ELEGIR, { animate: true })
    } else if (!m.getBounds().pad(-0.15).contains(donde)) {
      /* Después solo se recentra si el punto se salió de la vista. Hacerlo en
         cada cambio daría un salto justo al soltar el pin donde se quería, y
         pelearía con quien se aleja a propósito para orientarse. */
      m.setView(donde, m.getZoom(), { animate: true })
    }
  }, [punto])

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    m.eachLayer((capa) => {
      if (capa instanceof L.TileLayer) capa.setUrl(TESELAS[tema])
    })
  }, [tema])

  return (
    <div
      ref={caja}
      className="mapa mapa--elegir"
      role="application"
      aria-label="Mapa para señalar dónde está el daño. Toca el punto exacto o arrastra el pin."
    />
  )
}
