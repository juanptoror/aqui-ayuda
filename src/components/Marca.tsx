/**
 * Marca AquíAyuda: los cuatro recursos del brand kit.
 *
 * Los trazados salen de los PDF originales (Recurso 6 a 9), vectorizados tal
 * cual: no son una aproximación redibujada. Cada recurso se comprobó píxel a
 * píxel contra su PDF y no hay ninguna diferencia más allá del antialias.
 *
 * Los dos lockups no repiten geometría: son el mismo isotipo y el mismo
 * logotipo recolocados con la escala y la posición exactas del kit, así que
 * retocar una pieza arrastra las cuatro y no se pueden desincronizar.
 *
 * Va todo como SVG en línea, y no como <img>, por las dos razones de siempre:
 * hereda el color del contexto y no añade una petición de red que en una
 * emergencia puede no llegar.
 */

/** Medidas del artboard de cada pieza, en las unidades del PDF. */
const ISOTIPO = { ancho: 159.023, alto: 202.44 }
const LOGOTIPO = { ancho: 1668.59, alto: 301.031 }

/* Silueta exterior del pin, sin el monograma. Se pinta debajo cuando el AA
   va relleno: es lo que evita que el hueco deje ver el fondo. */
const D_PIN = 'M79.507 0C12.235 0 -24.527 78.449 18.54 130.141L78.297 201.873C78.926 202.629 80.087 202.629 80.717 201.873L140.473 130.141C153.266 114.794 159.023 97.078 159.023 79.752C159.023 38.769 126.795 0 79.507 0Z'

/* Contorno del monograma AA. En el kit es un hueco en el pin; aquí es un
   trazado suelto para poder pintarlo o dejarlo pasar según el fondo. */
const D_AA = 'M123.14 104.08L118.673 91.482C118.45 90.854 117.855 90.434 117.189 90.434L93.883 90.434C93.215 90.434 92.62 90.855 92.397 91.485L87.954 104.078C87.732 104.707 87.137 105.129 86.469 105.129L71.971 105.129C71.303 105.129 70.708 104.707 70.486 104.078L66.043 91.485C65.821 90.855 65.226 90.434 64.558 90.434L41.253 90.434C40.586 90.434 39.99 90.855 39.768 91.485L35.325 104.078C35.103 104.707 34.508 105.129 33.84 105.129L22.305 105.129C21.211 105.129 20.45 104.04 20.826 103.013L44.268 38.943C44.495 38.322 45.086 37.909 45.747 37.909L60.817 37.909C61.479 37.909 62.071 38.324 62.297 38.946L78.058 82.336C78.56 83.717 80.512 83.719 81.017 82.339L96.897 38.943C97.125 38.322 97.715 37.909 98.376 37.909L113.471 37.909C114.134 37.909 114.726 38.324 114.952 38.947L138.196 103.017C138.568 104.043 137.808 105.129 136.715 105.129L124.624 105.129C123.957 105.129 123.363 104.709 123.14 104.08'

/* Los dos triangulitos del interior de las aes: van del color del pin. */
const D_AA_CONTRAS = [
  'M54.296 57.531L61.005 76.719C61.363 77.743 60.603 78.813 59.518 78.813L46.179 78.813C45.097 78.813 44.337 77.747 44.69 76.724L51.321 57.536C51.809 56.125 53.803 56.121 54.296 57.531Z',
  'M106.925 57.531L113.634 76.719C113.992 77.742 113.232 78.813 112.147 78.813L98.808 78.813C97.726 78.813 96.966 77.747 97.319 76.724L103.95 57.536C104.438 56.125 106.432 56.121 106.925 57.531Z',
]

/* Logotipo «AquíAyuda», una letra por trazado. */
const D_LOGOTIPO = [
  'M84.686 3.308L0 234.87L51.274 234.87L69.139 184.258L157.13 184.258L174.995 234.87L228.256 234.87L144.23 3.308L84.686 3.308M112.805 56.236L143.57 144.23L82.37 144.23L112.805 56.236Z',
  'M361.909 149.855C361.909 135.078 358.159 123.225 350.66 114.293C343.161 105.362 333.127 100.896 320.558 100.896C307.986 100.896 297.896 105.362 290.288 114.293C282.681 123.225 278.875 134.968 278.875 149.523C278.875 164.299 282.681 176.208 290.288 185.25C297.896 194.293 307.986 198.814 320.558 198.814C333.127 198.814 343.161 194.293 350.66 185.25C358.159 176.208 361.909 164.41 361.909 149.855M407.89 301.031L361.246 301.031L361.246 213.038C348.454 228.916 331.364 236.855 309.972 236.855C294.754 236.855 281.19 233.382 269.284 226.436C257.372 219.488 248.054 209.454 241.329 196.332C234.605 183.21 231.24 167.828 231.24 150.185C231.24 132.983 234.605 117.766 241.329 104.534C248.054 91.302 257.372 81.048 269.284 73.769C281.19 66.493 294.645 62.853 309.641 62.853C321.33 62.853 331.639 65.058 340.57 69.469C349.504 73.88 356.833 79.945 362.569 87.664L367.202 64.838L407.89 64.838L407.89 301.031Z',
  'M600.419 234.87L559.07 234.87L554.77 214.36C548.814 221.418 541.866 226.931 533.927 230.9C525.988 234.87 516.285 236.855 504.816 236.855C484.971 236.855 468.76 230.735 456.189 218.496C443.62 206.255 437.335 185.801 437.335 157.131L437.335 64.837L483.976 64.837L483.976 151.508C483.976 166.945 486.678 178.578 492.083 186.407C497.484 194.236 505.811 198.15 517.057 198.15C528.745 198.15 537.788 193.795 544.184 185.084C550.58 176.373 553.778 164.188 553.778 148.531L553.778 64.837L600.419 64.837L600.419 234.87Z',
  'M664.264 0L717.521 0L674.187 46.644L640.115 46.644L664.264 0M632.836 64.837H679.811V234.87H632.836Z',
  'M840.583 144.23L809.818 56.236L779.384 144.23L840.583 144.23M781.699 3.308L841.246 3.308L925.269 234.87L872.009 234.87L854.147 184.258L766.152 184.258L748.29 234.87L697.013 234.87L781.699 3.308Z',
  'M1000.037 186.905L1040.396 64.838L1090.347 64.838L1014.924 259.019C1010.954 269.384 1007.205 277.489 1003.675 283.334C1000.148 289.178 995.683 293.588 990.279 296.566C984.874 299.542 977.874 301.031 969.272 301.031L923.954 301.031L923.954 261.665L949.755 261.665C955.711 261.665 960.009 260.673 962.656 258.689C965.302 256.704 967.84 252.844 970.263 247.11L974.564 235.864L909.067 64.838L958.686 64.838L1000.037 186.905Z',
  'M1266.334 234.87L1224.984 234.87L1220.682 214.36C1214.729 221.418 1207.781 226.931 1199.843 230.9C1191.902 234.87 1182.2 236.855 1170.731 236.855C1150.883 236.855 1134.673 230.735 1122.104 218.496C1109.532 206.255 1103.247 185.801 1103.247 157.131L1103.247 64.837L1149.891 64.837L1149.891 151.508C1149.891 166.945 1152.59 178.578 1157.995 186.407C1163.399 194.236 1171.724 198.15 1182.972 198.15C1194.657 198.15 1203.7 193.795 1210.096 185.084C1216.492 176.373 1219.69 164.188 1219.69 148.531L1219.69 64.837L1266.334 64.837L1266.334 234.87Z',
  'M1422.802 150.185C1422.802 135.41 1419.052 123.501 1411.553 114.458C1404.057 105.416 1394.023 100.896 1381.451 100.896C1368.882 100.896 1358.792 105.416 1351.184 114.458C1343.574 123.501 1339.771 135.3 1339.771 149.855C1339.771 164.41 1343.574 176.208 1351.184 185.25C1358.792 194.293 1368.882 198.814 1381.451 198.814C1394.023 198.814 1404.057 194.347 1411.553 185.416C1419.052 176.483 1422.802 164.74 1422.802 150.185M1468.783 234.871L1428.095 234.871L1423.465 211.383C1410.45 228.365 1392.811 236.855 1370.537 236.855C1355.538 236.855 1342.086 233.272 1330.177 226.104C1318.268 218.936 1308.95 208.736 1302.223 195.504C1295.498 182.272 1292.136 166.945 1292.136 149.523C1292.136 132.322 1295.498 117.16 1302.223 104.038C1308.95 90.916 1318.324 80.772 1330.342 73.604C1342.362 66.437 1355.87 62.853 1370.865 62.853C1392.92 62.853 1410.01 70.572 1422.139 86.009L1422.139 3.308L1468.783 3.308L1468.783 234.871Z',
  'M1572.328 161.432C1562.625 161.432 1555.071 163.361 1549.669 167.221C1544.268 171.08 1541.566 176.539 1541.566 183.595C1541.566 189.551 1543.825 194.292 1548.346 197.82C1552.867 201.348 1558.987 203.113 1566.707 203.113C1578.836 203.113 1588.43 199.639 1595.486 192.693C1602.542 185.746 1606.18 176.429 1606.403 164.74L1606.403 161.432L1572.328 161.432M1668.594 234.87L1644.776 234.87C1623.385 234.87 1612.907 225.608 1613.351 207.083C1607.175 216.787 1599.567 224.175 1590.524 229.247C1581.482 234.319 1570.565 236.855 1557.776 236.855C1538.808 236.855 1523.536 232.5 1511.959 223.789C1500.382 215.078 1494.59 202.783 1494.59 186.905C1494.59 168.82 1501.262 154.872 1514.605 145.058C1527.946 135.244 1547.298 130.337 1572.66 130.337L1606.403 130.337L1606.403 122.067C1606.403 114.348 1603.534 108.228 1597.801 103.707C1592.068 99.185 1584.348 96.926 1574.646 96.926C1566.044 96.926 1558.987 98.799 1553.474 102.549C1547.959 106.299 1544.652 111.37 1543.549 117.766L1498.56 117.766C1500.106 100.344 1507.822 86.836 1521.717 77.242C1535.61 67.65 1554.026 62.853 1576.961 62.853C1600.999 62.853 1619.579 68.146 1632.703 78.731C1645.823 89.317 1652.384 104.644 1652.384 124.714L1652.384 184.588C1652.384 188.778 1653.264 191.646 1655.03 193.189C1656.797 194.732 1659.552 195.504 1663.301 195.504L1668.594 195.504L1668.594 234.87Z',
]

/**
 * Ancho y alto en píxeles a partir de uno de los dos: así ninguna pieza se
 * deforma, que es el error clásico al meter un logo en una caja fija.
 */
function medidas(pieza: { ancho: number; alto: number }, alto?: number, ancho?: number) {
  const razon = pieza.ancho / pieza.alto
  if (ancho != null) return { width: ancho, height: +(ancho / razon).toFixed(2) }
  const h = alto ?? pieza.alto
  return { width: +(h * razon).toFixed(2), height: h }
}

type PropsBase = {
  /** Alto en píxeles. El ancho sale solo. */
  alto?: number
  /** Ancho en píxeles. Si se da, manda sobre `alto`. */
  ancho?: number
  /** Color de la marca. Por defecto hereda el del contexto. */
  color?: string
  /** Texto alternativo. Sin él la pieza queda como decorativa. */
  title?: string
  className?: string
}

/** Atributos comunes: si no hay `title`, la pieza es decorativa y se oculta. */
function accesibilidad(title?: string) {
  return title
    ? { role: 'img' as const, 'aria-label': title }
    : { role: 'presentation' as const, 'aria-hidden': true }
}

/**
 * Recurso 7 — isotipo (el pin con el monograma AA).
 *
 * En el kit el AA es un hueco, pensado para una marca de un solo color sobre
 * un fondo que contraste. Sobre superficies claras eso deja el amarillo con el
 * monograma casi invisible, así que por defecto el AA va relleno en
 * `--on-brand`. Con `contramarca="hueca"` se recupera el recurso tal cual, que
 * es lo que toca sobre fondo oscuro o sobre el propio amarillo.
 */
export function Isotipo({
  alto,
  ancho,
  color = 'var(--amarillo)',
  contramarca = 'solida',
  colorContramarca = 'var(--on-brand)',
  title,
  className,
}: PropsBase & {
  contramarca?: 'solida' | 'hueca'
  colorContramarca?: string
}) {
  const { width, height } = medidas(ISOTIPO, alto ?? 32, ancho)
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${ISOTIPO.ancho} ${ISOTIPO.alto}`}
      fill={color}
      className={className}
      {...accesibilidad(title)}
    >
      {contramarca === 'hueca' ? (
        <path d={`${D_PIN}${D_AA}`} />
      ) : (
        <>
          <path d={D_PIN} />
          <path d={D_AA} fill={colorContramarca} />
        </>
      )}
      {D_AA_CONTRAS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

/** Recurso 9 — logotipo suelto. Para cuando el pin ya está cerca. */
export function Logotipo({ alto, ancho, color = 'currentColor', title, className }: PropsBase) {
  const { width, height } = medidas(LOGOTIPO, alto ?? 24, ancho)
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${LOGOTIPO.ancho} ${LOGOTIPO.alto}`}
      fill={color}
      className={className}
      {...accesibilidad(title)}
    >
      {D_LOGOTIPO.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

/** Isotipo y logotipo dentro de un lockup, con la colocación exacta del kit. */
function Lockup({
  caja,
  pin,
  texto,
  alto,
  ancho,
  color,
  title,
  className,
}: PropsBase & {
  caja: { ancho: number; alto: number }
  pin: { escala: number; x: number; y: number }
  texto: { escala: number; x: number; y: number }
}) {
  const { width, height } = medidas(caja, alto, ancho)
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${caja.ancho} ${caja.alto}`}
      fill={color ?? 'currentColor'}
      className={className}
      {...accesibilidad(title)}
    >
      <g transform={`translate(${pin.x} ${pin.y}) scale(${pin.escala})`}>
        <path d={`${D_PIN}${D_AA}`} />
        {D_AA_CONTRAS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g transform={`translate(${texto.x} ${texto.y}) scale(${texto.escala})`}>
        {D_LOGOTIPO.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  )
}

const CAJA_H = { ancho: 775.862, alto: 202.44 }
const CAJA_V = { ancho: 993.642, alto: 605.364 }

/**
 * Recurso 6 — lockup horizontal. Para franjas anchas y bajas: barras
 * superiores, pies de página, cabeceras de documento.
 *
 * De una sola tinta, como el recurso: el AA queda hueco y lo rellena el fondo.
 */
export function LockupHorizontal(props: PropsBase) {
  return (
    <Lockup
      {...props}
      caja={CAJA_H}
      pin={{ escala: 1, x: 0, y: 0 }}
      texto={{ escala: 0.332849, x: 220.472, y: 58.499 }}
      alto={props.alto ?? 40}
    />
  )
}

/**
 * Recurso 8 — lockup vertical. Para bloques centrados con aire alrededor:
 * portada, pantallas de espera, mensajes a página completa.
 */
export function LockupVertical(props: PropsBase) {
  return (
    <Lockup
      {...props}
      caja={CAJA_V}
      pin={{ escala: 1.78909, x: 361.265, y: 0 }}
      texto={{ escala: 0.595498, x: 0, y: 426.1 }}
      alto={props.alto ?? 96}
    />
  )
}

/** Colores de pin por ciudad, tal como los define el brand kit. */
export const COLOR_PIN_CIUDAD: Record<string, string> = {
  'pereira-2': 'var(--amarillo)',
  pereira: 'var(--amarillo)',
  cali: 'var(--lima)',
  manizales: 'var(--naranja)',
  'bogota-d-c': 'var(--rojo)',
}

export function colorPinDe(slug: string | undefined): string {
  if (!slug) return 'var(--amarillo)'
  return COLOR_PIN_CIUDAD[slug] ?? 'var(--amarillo)'
}
