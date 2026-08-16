import { Component, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Compass, TriangleAlert } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, EmptyState } from '@/components/ui'
import { ProveedorPreferencias } from '@/state/preferencias'
import { ProveedorSesion } from '@/state/sesion'
import { Landing } from '@/pages/Landing'
import { Ciudad } from '@/pages/Ciudad'
import { Ciudades } from '@/pages/Ciudades'
import { Centro } from '@/pages/Centro'
import { Afectaciones } from '@/pages/Afectaciones'
import { QueFalta } from '@/pages/QueFalta'
import { AyudaDirecta } from '@/pages/AyudaDirecta'
import { ComoAyudar } from '@/pages/ComoAyudar'
import { Acerca } from '@/pages/Acerca'
import { Estado } from '@/pages/Estado'
import { Inventario } from '@/pages/Inventario'
import { Manos } from '@/pages/Manos'
import { Mapa } from '@/pages/Mapa'
import { Vivienda } from '@/pages/Vivienda'
import { QuieroAyudar } from '@/pages/QuieroAyudar'

const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * Un fallo de render en una pantalla no puede dejar la app en blanco: en una
 * emergencia eso equivale a que la herramienta no exista.
 */
class LimiteDeError extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Fallo de render:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container" style={{ paddingBlock: 'var(--sp-9)' }}>
          <EmptyState
            tono="critical"
            icono={TriangleAlert}
            titulo="Algo se rompió en esta pantalla"
            texto="Puedes volver a cargar la página. Si vuelve a pasar, el resto de la app sigue funcionando desde el inicio."
            acciones={
              <>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => window.location.reload()}
                >
                  <span>Recargar</span>
                </button>
                <a className="btn" href="/">
                  <span>Ir al inicio</span>
                </a>
              </>
            }
          />
        </div>
      )
    }
    return this.props.children
  }
}

function NoEncontrada() {
  return (
    <>
      <PageHeader
        titulo="Esta página no existe"
        subtitulo="El enlace puede estar incompleto o haber cambiado."
      />
      <div className="container">
        <EmptyState
          icono={Compass}
          titulo="No hay nada en esta dirección"
          texto="Vuelve al inicio para buscar tu municipio y ver los centros de acopio activos."
          acciones={
            <Link className="btn btn--primary" to="/">
              <span>Ir al inicio</span>
            </Link>
          }
        />
      </div>
    </>
  )
}

export function App() {
  return (
    <QueryClientProvider client={cliente}>
      <ProveedorSesion>
        <ProveedorPreferencias>
          <BrowserRouter>
            <AppShell>
              <LimiteDeError>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/ciudades" element={<Ciudades />} />
                  <Route path="/ciudad/:slug" element={<Ciudad />} />
                  <Route path="/centro/:id" element={<Centro />} />
                  <Route path="/que-falta" element={<QueFalta />} />
                  <Route path="/inventario" element={<Inventario />} />
                  <Route path="/ayuda-directa" element={<AyudaDirecta />} />
                  <Route path="/manos" element={<Manos />} />
                  <Route path="/mapa" element={<Mapa />} />
                  <Route path="/afectaciones" element={<Afectaciones />} />
                  {/* La pantalla vivió un tiempo en /danos y esa dirección ya
                      se compartió por ahí. Redirige en vez de dar un 404: un
                      enlace muerto a un mapa de peligros es peor que feo. */}
                  <Route path="/danos" element={<Navigate to="/afectaciones" replace />} />
                  <Route path="/vivienda" element={<Vivienda />} />
                  <Route path="/quiero-ayudar" element={<QuieroAyudar />} />
                  <Route path="/como-ayudar" element={<ComoAyudar />} />
                  <Route path="/acerca" element={<Acerca />} />
                  <Route path="/estado" element={<Estado />} />
                  <Route path="*" element={<NoEncontrada />} />
                </Routes>
              </LimiteDeError>
            </AppShell>
          </BrowserRouter>
        </ProveedorPreferencias>
      </ProveedorSesion>
    </QueryClientProvider>
  )
}
