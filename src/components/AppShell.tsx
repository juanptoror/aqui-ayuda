import { Link, useLocation } from 'react-router-dom'
import {
  Activity,
  BedDouble,
  Building2,
  ChevronsUpDown,
  Construction,
  HandHeart,
  HeartHandshake,
  Home,
  Info,
  MapPin,
  MapPinned,
  Menu,
  Moon,
  Sun,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { usePreferencias } from '@/state/preferencias'
import { useMunicipios } from '@/datos/consultas'
import { BotonAcceso } from './Acceso'
import { SelectorCiudad } from './SelectorCiudad'
import { Sheet } from './ui'
import { Isotipo, LockupHorizontal } from './Marca'

interface Destino {
  a: string
  etiqueta: string
  etiquetaCorta: string
  icono: typeof Home
}

/* Cinco destinos más el botón "Más": en 375px caben a 56px cada uno, y por eso
   las etiquetas cortas de la barra inferior son de una sola palabra. */
const DESTINOS: Destino[] = [
  { a: '/', etiqueta: 'Inicio', etiquetaCorta: 'Inicio', icono: Home },
  { a: '/ayuda-directa', etiqueta: 'Quién necesita ayuda', etiquetaCorta: 'Piden', icono: HandHeart },
  { a: '/quiero-ayudar', etiqueta: 'Quiero ayudar', etiquetaCorta: 'Ayudar', icono: HeartHandshake },
  { a: '/que-falta', etiqueta: 'Qué falta y qué hay', etiquetaCorta: 'Falta', icono: TriangleAlert },
  { a: '/vivienda', etiqueta: 'Dónde vivir', etiquetaCorta: 'Vivienda', icono: BedDouble },
]

/**
 * Destinos que no entran en los cinco de abajo.
 *
 * No son menos importantes: son menos frecuentes. El directorio de centros se
 * consulta una vez y luego se vuelve por el municipio guardado, y el mapa es
 * una forma de mirar lo mismo que ya está en las otras pantallas.
 */
const SECUNDARIOS: Destino[] = [
  { a: '/ciudades', etiqueta: 'Centros de acopio', etiquetaCorta: 'Centros', icono: Building2 },
  { a: '/mapa', etiqueta: 'Mapa de la ayuda', etiquetaCorta: 'Mapa', icono: MapPin },
  /* Va aquí y no abajo por una razón incómoda: se consulta una vez, cuando se
     va a salir a la calle. Las cinco de abajo se consultan todo el rato. */
  { a: '/afectaciones', etiqueta: 'Daños y vías cerradas', etiquetaCorta: 'Daños', icono: Construction },
  { a: '/como-ayudar', etiqueta: 'Cómo ayudar', etiquetaCorta: 'Guía', icono: HeartHandshake },
]

/**
 * Lo que hay detrás de "Más" en la barra inferior.
 *
 * Existe porque la barra lateral solo aparece a partir de 1024px y llevaba
 * sola estos destinos: por debajo de esa anchura no había forma de llegar a
 * ellos. `/mapa`, `/afectaciones` y `/estado` no estaban enlazados desde ninguna de
 * las cinco pantallas de la barra, así que en un celular solo se alcanzaban
 * escribiendo la URL. `/afectaciones` es la pantalla de edificios afectados y vías
 * cerradas, en una app que da por hecho que quien la abre acaba de pasar por
 * un terremoto y la abre desde el celular.
 *
 * `/estado` no estaba ni siquiera en la lateral.
 */
const EN_MAS: Destino[] = [
  ...SECUNDARIOS,
  { a: '/acerca', etiqueta: 'Acerca del proyecto', etiquetaCorta: 'Acerca', icono: Info },
  { a: '/estado', etiqueta: 'Estado de las fuentes', etiquetaCorta: 'Estado', icono: Activity },
]

/**
 * Rutas hijas que no comparten prefijo con su padre.
 *
 * `/ciudad/dosquebradas` NO empieza por `/ciudades`, así que ni NavLink ni un
 * `startsWith` marcaban el padre: se navegaba a la ficha de un centro y la
 * barra lateral se quedaba sin ningún destino resaltado, como si estuvieras
 * fuera de la aplicación. Esto es la tabla de parentesco que faltaba.
 */
const HIJAS: Record<string, string[]> = {
  '/ciudades': ['/ciudad/', '/centro/'],
  '/que-falta': ['/inventario'],
  '/quiero-ayudar': ['/manos'],
}

function esActivo(pathname: string, destino: string): boolean {
  if (destino === '/') return pathname === '/'
  if (pathname === destino || pathname.startsWith(`${destino}/`)) return true
  return (HIJAS[destino] ?? []).some((prefijo) => pathname.startsWith(prefijo))
}

function BotonTema({ compacto }: { compacto?: boolean }) {
  const { tema, alternarTema } = usePreferencias()
  const esOscuro = tema === 'dark'
  return (
    <button
      type="button"
      className={compacto ? 'btn btn--ghost btn--icon' : 'btn btn--ghost'}
      onClick={alternarTema}
      aria-label={esOscuro ? 'Usar tema claro' : 'Usar tema oscuro'}
      title={esOscuro ? 'Tema claro' : 'Tema oscuro'}
    >
      {esOscuro ? (
        <Sun size={compacto ? 18 : 19} strokeWidth={2.1} />
      ) : (
        <Moon size={compacto ? 18 : 19} strokeWidth={2.1} />
      )}
      {!compacto && <span>{esOscuro ? 'Tema claro' : 'Tema oscuro'}</span>}
    </button>
  )
}

function MarcaCompacta() {
  return (
    <Link to="/" className="sidebar__brand marca-compacta" style={{ marginBottom: 0 }}>
      {/* La cabecera es una franja ancha y baja sin coletilla debajo: es el
          caso exacto del lockup horizontal, así que aquí va la pieza entera
          en vez de un pin y un texto que pueden descuadrarse entre sí.

          Por debajo de 400px se cambia por el pin suelto. En esa franja el
          lockup se comía el ancho que necesita el municipio y el nombre
          quedaba en "Do...", que es peor que no ponerlo: casi todo lo que
          muestra la app depende de qué municipio esté elegido. Se cambia la
          pieza entera en vez de encogerla porque el pin está pensado para
          funcionar solo. */}
      <LockupHorizontal
        alto={26}
        color="var(--brand-on-soft)"
        title="AquíAyuda"
        className="marca-compacta__lockup"
      />
      <Isotipo alto={26} title="AquíAyuda" className="marca-compacta__pin" />
    </Link>
  )
}

/**
 * El municipio elegido, siempre a la vista y siempre cambiable.
 *
 * Antes vivía escondido dentro de cada pantalla: para cambiar de municipio
 * había que estar en una que tuviera el botón. Casi todo lo que muestra la app
 * —qué falta, qué hay, quién puede ayudar— depende de esta elección, así que
 * tiene que estar donde nunca se pierda de vista.
 */
function bonito(slug: string): string {
  return slug
    .replace(/-\d+$/, '')
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function MunicipioActivo({ compacto }: { compacto?: boolean }) {
  const { ciudadGuardada } = usePreferencias()
  const [abierto, setAbierto] = useState(false)
  const { data: ciudades } = useMunicipios()

  /* Mientras carga la lista solo tenemos el slug, y enseñarlo crudo delata la
     costura: el municipio fusionado se llama `pereira-2` y nadie vive en un
     sitio llamado así. Se maquilla el slug hasta que llegue el nombre real. */
  const nombre = ciudadGuardada
    ? (ciudades ?? []).find((c) => c.slug === ciudadGuardada)?.nombre ?? bonito(ciudadGuardada)
    : null

  return (
    <>
      <button
        type="button"
        className={compacto ? 'municipio municipio--compacto' : 'municipio'}
        onClick={() => setAbierto(true)}
        title={nombre ? `Municipio: ${nombre}. Pulsa para cambiar` : 'Elegir municipio'}
      >
        <MapPinned size={17} strokeWidth={2.2} />
        <span className="municipio__texto">
          {!compacto && <span className="municipio__label">Municipio</span>}
          <span className="municipio__nombre truncate">{nombre ?? 'Sin elegir'}</span>
        </span>
        <ChevronsUpDown size={15} strokeWidth={2.4} className="municipio__chevron" />
      </button>
      <SelectorCiudad abierto={abierto} alCerrar={() => setAbierto(false)} />
    </>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [masAbierto, setMasAbierto] = useState(false)

  /* La hoja pertenece a la barra inferior, que no existe a partir de 1024px.
     Si se abre en un celular y luego se gira o se agranda la ventana, se queda
     un diálogo huérfano encima de una pantalla que ya tiene barra lateral. */
  useEffect(() => {
    if (!masAbierto) return
    const ancha = window.matchMedia('(min-width: 1024px)')
    const alCambiar = () => {
      if (ancha.matches) setMasAbierto(false)
    }
    alCambiar()
    ancha.addEventListener('change', alCambiar)
    return () => ancha.removeEventListener('change', alCambiar)
  }, [masAbierto])

  return (
    <div className="shell">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <nav className="sidebar" aria-label="Navegación principal">
        <Link to="/" className="sidebar__brand">
          <span className="brand-mark">
            <Isotipo alto={32} title="AquíAyuda" />
          </span>
          <span className="brand-text">
            <span className="brand-text__name">AquíAyuda</span>
            <span className="brand-text__tag">Todo lo que necesites</span>
          </span>
        </Link>

        <MunicipioActivo />

        <span className="sidebar__label">Navegación</span>

        {[...DESTINOS, ...SECUNDARIOS].map((d) => (
          <Link
            key={d.a}
            to={d.a}
            className={`navlink${esActivo(pathname, d.a) ? ' navlink--active' : ''}`}
            aria-current={esActivo(pathname, d.a) ? 'page' : undefined}
          >
            <d.icono size={19} strokeWidth={2.1} />
            <span>{d.etiqueta}</span>
          </Link>
        ))}

        {/* Orden pedido: tema, acerca y salir al final. Lo que se toca a diario
            arriba; lo que se toca una vez, abajo del todo. */}
        <div className="sidebar__foot">
          <BotonTema />
          <Link
            to="/acerca"
            className={`navlink${esActivo(pathname, '/acerca') ? ' navlink--active' : ''}`}
          >
            <Info size={19} strokeWidth={2.1} />
            <span>Acerca del proyecto</span>
          </Link>
          <BotonAcceso />
        </div>
      </nav>

      <div className="main-col">
        <header className="topbar">
          <MarcaCompacta />
          <div className="spacer" />
          <MunicipioActivo compacto />
          <BotonAcceso compacto />
          <BotonTema compacto />
        </header>

        <main className="main" id="contenido">
          {children}
        </main>
      </div>

      <nav className="bottomnav" aria-label="Navegación principal">
        {DESTINOS.map((d) => {
          const activo = esActivo(pathname, d.a)
          return (
            <Link
              key={d.a}
              to={d.a}
              className={`bottomnav__item${activo ? ' bottomnav__item--active' : ''}`}
              aria-current={activo ? 'page' : undefined}
            >
              <d.icono size={21} strokeWidth={2.1} />
              <span>{d.etiquetaCorta}</span>
            </Link>
          )
        })}

        {/* Se marca activo cuando la pantalla actual está detrás de él: si no,
            al entrar en Daños la barra se quedaba sin ningún destino resaltado
            y parecía que estabas fuera de la aplicación. */}
        <button
          type="button"
          className={`bottomnav__item${
            EN_MAS.some((d) => esActivo(pathname, d.a)) ? ' bottomnav__item--active' : ''
          }`}
          onClick={() => setMasAbierto(true)}
          aria-haspopup="dialog"
          aria-expanded={masAbierto}
        >
          <Menu size={21} strokeWidth={2.1} />
          <span>Más</span>
        </button>
      </nav>

      <Sheet
        abierta={masAbierto}
        alCerrar={() => setMasAbierto(false)}
        titulo="Todo lo demás"
        subtitulo="Las cinco de la barra se consultan a diario. Estas, de vez en cuando."
      >
        <div className="sheet__nav">
          {EN_MAS.map((d) => {
            const activo = esActivo(pathname, d.a)
            return (
              <Link
                key={d.a}
                to={d.a}
                className={`navlink${activo ? ' navlink--active' : ''}`}
                aria-current={activo ? 'page' : undefined}
                onClick={() => setMasAbierto(false)}
              >
                <d.icono size={19} strokeWidth={2.1} />
                <span>{d.etiqueta}</span>
              </Link>
            )
          })}
        </div>
      </Sheet>
    </div>
  )
}
