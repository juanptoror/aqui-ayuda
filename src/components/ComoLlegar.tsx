import { MapPin, Navigation } from 'lucide-react'
import { enlaceComoLlegar, enlaceVerEnMapa, precisionDestino, type Destino } from '@/lib/mapas'

/**
 * El botón de llegar a un sitio.
 *
 * Existe como componente y no como un enlace suelto en cada pantalla porque
 * la decisión difícil no es el estilo, es qué hacer cuando NO hay coordenada:
 * la mitad de los registros solo tienen una dirección escrita a mano. Aquí se
 * resuelve una vez —y se dice que es aproximada— en vez de decidirlo distinto
 * en cada uno de los seis sitios donde aparece.
 *
 * Abre la app de mapas del teléfono. No cargamos la API de Google, que se
 * factura por mapa mostrado; para llegar a un sitio no aporta nada que la app
 * nativa no haga mejor.
 */

interface Props {
  destino: Destino
  /** `dir` navega paso a paso; `ver` solo enseña dónde está. */
  modo?: 'dir' | 'ver'
  variante?: 'boton' | 'enlace'
  tamano?: 'sm' | 'md'
  /** Texto propio. Por defecto, "Cómo llegar" o "Ver en el mapa". */
  etiqueta?: string
}

export function ComoLlegar({
  destino,
  modo = 'dir',
  variante = 'boton',
  tamano = 'md',
  etiqueta,
}: Props) {
  const url = modo === 'dir' ? enlaceComoLlegar(destino) : enlaceVerEnMapa(destino)
  const precision = precisionDestino(destino)

  // Sin coordenada NI dirección no hay nada a dónde ir. Un botón que abre un
  // mapa en blanco es peor que no tener botón: hace bajar a la calle a alguien
  // que se cree que sabe dónde va.
  if (!url) return null

  const Icono = modo === 'dir' ? Navigation : MapPin
  const texto = etiqueta ?? (modo === 'dir' ? 'Cómo llegar' : 'Ver en el mapa')
  const titulo =
    precision === 'aproximada'
      ? 'Ubicación aproximada: este sitio solo tiene dirección escrita, no coordenada exacta.'
      : undefined

  if (variante === 'enlace') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="enlace-mapa"
        title={titulo}
      >
        <Icono size={15} strokeWidth={2.2} />
        <span>{texto}</span>
        {precision === 'aproximada' && <span className="enlace-mapa__aprox">aprox.</span>}
      </a>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn${tamano === 'sm' ? ' btn--sm' : ''}`}
      title={titulo}
    >
      <Icono size={tamano === 'sm' ? 15 : 17} />
      <span>{texto}</span>
      {precision === 'aproximada' && <span className="enlace-mapa__aprox">aprox.</span>}
    </a>
  )
}
