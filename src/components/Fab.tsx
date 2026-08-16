import type { LucideIcon } from 'lucide-react'

/**
 * La acción principal de una pantalla, al alcance del pulgar.
 *
 * En escritorio la acción vive en la cabecera y se ve entera sin hacer nada.
 * En un celular esa cabecera se queda arriba del todo: se hace scroll para leer
 * la lista y, para volver a "publicar" o "reportar", hay que subir hasta
 * arriba. En esta app eso importa más de lo normal —quien reporta un edificio
 * agrietado está de pie en la calle, con una mano— así que la acción baja a
 * donde está el pulgar y se queda ahí.
 *
 * Tres decisiones:
 *
 * - **Solo en móvil.** Por encima de 1024px no hay barra inferior y la cabecera
 *   está siempre a la vista: un botón flotante ahí sería un duplicado tapando
 *   contenido.
 * - **Encima de la barra, nunca sobre ella.** Se posiciona sumando la altura de
 *   la barra inferior y el área segura del dispositivo. Un botón que tape
 *   "Vivienda" o "Más" cambia una acción por otra en el peor momento.
 * - **No sustituye al botón de la cabecera, lo repite.** Quien ya está arriba lo
 *   encuentra donde lo esperaba; el flotante es para quien va por la mitad de
 *   la lista. Los dos son alcanzables con teclado y lector de pantalla, y los
 *   dos dicen lo mismo: duplicar la puerta no es duplicar la acción.
 */
export function Fab({
  etiqueta,
  icono: Icono,
  alPulsar,
}: {
  /** Lo que hace, en imperativo y corto: "Reportar un daño". */
  etiqueta: string
  icono: LucideIcon
  alPulsar: () => void
}) {
  return (
    <button type="button" className="fab" onClick={alPulsar}>
      <Icono size={20} strokeWidth={2.3} />
      <span>{etiqueta}</span>
    </button>
  )
}
