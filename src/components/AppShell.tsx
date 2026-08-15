import { Link, useLocation } from 'react-router-dom'
import {
  BedDouble,
  Boxes,
  Building2,
  ChevronsUpDown,
  HandHeart,
  HeartHandshake,
  Home,
  Info,
  MapPin,
  MapPinned,
  Moon,
  Sun,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { usePreferencias } from '@/state/preferencias'
import { useMunicipios } from '@/datos/consultas'
import { BotonAcceso } from './Acceso'
import { SelectorCiudad } from './SelectorCiudad'
import { Isotipo, LockupHorizontal } from './Marca'

interface Destino {
  a: string
  etiqueta: string
  etiquetaCorta: string
  icono: typeof Home
}

/* Cinco destinos: en 375px caben a 75px cada uno, y por eso las etiquetas
   cortas de la barra inferior son de una sola palabra. */
const DESTINOS: Destino[] = [
  { a: '/', etiqueta: 'Inicio', etiquetaCorta: 'Inicio', icono: Home },
  { a: '/ciudades', etiqueta: 'Centros de acopio', etiquetaCorta: 'Centros', icono: Building2 },
  { a: '/ayuda-directa', etiqueta: 'Ayuda entre personas', etiquetaCorta: 'Personas', icono: HandHeart },
  { a: '/que-falta', etiqueta: 'Qué falta', etiquetaCorta: 'Falta', icono: TriangleAlert },
  { a: '/inventario', etiqueta: 'Qué hay y dónde', etiquetaCorta: 'Qué hay', icono: Boxes },
]

/** Destinos que solo aparecen en la barra lateral, por falta de sitio abajo. */
const SECUNDARIOS: Destino[] = [
  { a: '/quiero-ayudar', etiqueta: 'Tengo algo que dar', etiquetaCorta: 'Tengo', icono: HandHeart },
  { a: '/mapa', etiqueta: 'Mapa de la ayuda', etiquetaCorta: 'Mapa', icono: MapPin },
  { a: '/manos', etiqueta: 'Quién puede ayudar', etiquetaCorta: 'Manos', icono: Users },
  { a: '/vivienda', etiqueta: 'Vivienda en arriendo', etiquetaCorta: 'Vivienda', icono: BedDouble },
  { a: '/como-ayudar', etiqueta: 'Cómo ayudar', etiquetaCorta: 'Guía', icono: HeartHandshake },
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
    <Link to="/" className="sidebar__brand" style={{ marginBottom: 0 }}>
      {/* La cabecera es una franja ancha y baja sin coletilla debajo: es el
          caso exacto del lockup horizontal, así que aquí va la pieza entera
          en vez de un pin y un texto que pueden descuadrarse entre sí. */}
      <LockupHorizontal alto={26} color="var(--brand-on-soft)" title="AquíAyuda" />
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
      </nav>
    </div>
  )
}
