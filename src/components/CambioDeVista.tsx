import { Link, useLocation } from 'react-router-dom'

/**
 * Dos pantallas que son la misma pregunta por sus dos caras.
 *
 * La aplicación había llegado a diez destinos y en móvil solo caben cinco.
 * Cuatro de ellos venían de parejas: "qué falta" y "qué hay" miran el mismo
 * inventario del mismo municipio desde lados opuestos, y "dónde encaja lo que
 * tengo" y "quién puede ayudar" responden ambas a quien quiere echar una mano.
 *
 * En vez de fusionarlas en una pantalla con el doble de contenido, cada pareja
 * comparte un interruptor y **una sola entrada en el menú**. Se pierde un
 * destino de la navegación y no se pierde ni una pantalla.
 */

export interface Vista {
  a: string
  etiqueta: string
}

export function CambioDeVista({ vistas }: { vistas: Vista[] }) {
  const { pathname } = useLocation()

  return (
    <div className="segmented segmented--enlaces" role="tablist" style={{ maxWidth: 560 }}>
      {vistas.map((v) => {
        const activa = pathname === v.a || pathname.startsWith(`${v.a}/`)
        return (
          <Link
            key={v.a}
            to={v.a}
            role="tab"
            aria-selected={activa}
            className="segmented__option"
          >
            <span>{v.etiqueta}</span>
          </Link>
        )
      })}
    </div>
  )
}

/* Las dos parejas que existen hoy. Viven aquí y no en cada pantalla para que
   añadir una tercera vista a una pareja sea un cambio en un solo sitio. */
export const VISTAS_MUNICIPIO: Vista[] = [
  { a: '/que-falta', etiqueta: 'Qué falta' },
  { a: '/inventario', etiqueta: 'Qué hay y dónde' },
]

export const VISTAS_AYUDAR: Vista[] = [
  { a: '/quiero-ayudar', etiqueta: 'Dónde encaja lo mío' },
  { a: '/manos', etiqueta: 'Quién más ayuda' },
]
