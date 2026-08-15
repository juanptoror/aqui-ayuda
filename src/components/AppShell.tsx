import { NavLink, Link, useLocation } from 'react-router-dom'
import {
  Boxes,
  Building2,
  HandHeart,
  HeartHandshake,
  Home,
  Info,
  MapPin,
  Moon,
  Sun,
  TriangleAlert,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { usePreferencias } from '@/state/preferencias'
import { BotonAcceso } from './Acceso'
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
  { a: '/mapa', etiqueta: 'Mapa de la ayuda', etiquetaCorta: 'Mapa', icono: MapPin },
  { a: '/manos', etiqueta: 'Quién puede ayudar', etiquetaCorta: 'Manos', icono: Users },
  { a: '/como-ayudar', etiqueta: 'Cómo ayudar', etiquetaCorta: 'Guía', icono: HeartHandshake },
]

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
      {esOscuro ? <Sun size={18} /> : <Moon size={18} />}
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

        <span className="sidebar__label">Navegación</span>

        {DESTINOS.map((d) => (
          <NavLink
            key={d.a}
            to={d.a}
            end={d.a === '/'}
            className={({ isActive }) => `navlink${isActive ? ' navlink--active' : ''}`}
          >
            <d.icono size={19} strokeWidth={2.1} />
            <span>{d.etiqueta}</span>
          </NavLink>
        ))}

        {SECUNDARIOS.map((d) => (
          <NavLink
            key={d.a}
            to={d.a}
            className={({ isActive }) => `navlink${isActive ? ' navlink--active' : ''}`}
          >
            <d.icono size={19} strokeWidth={2.1} />
            <span>{d.etiqueta}</span>
          </NavLink>
        ))}

        <div className="sidebar__foot">
          <NavLink
            to="/acerca"
            className={({ isActive }) => `navlink${isActive ? ' navlink--active' : ''}`}
          >
            <Info size={19} strokeWidth={2.1} />
            <span>Acerca del proyecto</span>
          </NavLink>
          <BotonAcceso />
          <BotonTema />
        </div>
      </nav>

      <div className="main-col">
        <header className="topbar">
          <MarcaCompacta />
          <div className="spacer" />
          <BotonAcceso compacto />
          <BotonTema compacto />
        </header>

        <main className="main" id="contenido">
          {children}
        </main>
      </div>

      <nav className="bottomnav" aria-label="Navegación principal">
        {DESTINOS.map((d) => {
          const activo = d.a === '/' ? pathname === '/' : pathname.startsWith(d.a)
          return (
            <NavLink
              key={d.a}
              to={d.a}
              className={`bottomnav__item${activo ? ' bottomnav__item--active' : ''}`}
            >
              <d.icono size={21} strokeWidth={2.1} />
              <span>{d.etiquetaCorta}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
