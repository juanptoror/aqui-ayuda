import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, MapPin, Search } from 'lucide-react'
import { Sheet, EmptyState } from './ui'
import { useCiudadesCercanas } from '@/data/useDatos'
import { usePreferencias } from '@/state/preferencias'
import { coordenadaDeCiudad, formatearDistancia } from '@/lib/geo'

/** Quita tildes para que "apia" encuentre "Apía" y "bogota" encuentre "Bogotá". */
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(DIACRITICOS, '')
}

export function SelectorCiudad({
  abierto,
  alCerrar,
}: {
  abierto: boolean
  alCerrar: () => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const navegar = useNavigate()
  const { ubicacion, fijarUbicacion, fijarCiudadGuardada } = usePreferencias()
  const { ciudades, cargando } = useCiudadesCercanas(ubicacion)

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return ciudades
    return ciudades.filter(
      (c) => normalizar(c.nombre).includes(q) || normalizar(c.departamento).includes(q),
    )
  }, [ciudades, busqueda])

  function elegir(slug: string) {
    fijarCiudadGuardada(slug)
    // Si el usuario nunca dio permiso de GPS, la ciudad elegida pasa a ser su
    // referencia de ubicación: así el orden por cercanía funciona igual.
    if (!ubicacion) {
      const coord = coordenadaDeCiudad(slug)
      if (coord) fijarUbicacion(coord)
    }
    setBusqueda('')
    alCerrar()
    navegar(`/ciudad/${slug}`)
  }

  return (
    <Sheet
      abierta={abierto}
      alCerrar={alCerrar}
      titulo="Elige tu municipio"
      subtitulo={
        ubicacion ? 'Ordenados del más cercano al más lejano.' : 'Ordenados alfabéticamente.'
      }
    >
      <div className="search" style={{ marginBottom: 'var(--sp-4)' }}>
        <Search size={17} className="search__icon" />
        <input
          className="input"
          type="search"
          placeholder="Buscar municipio o departamento"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar municipio"
        />
      </div>

      {cargando ? (
        <div className="stack" style={{ ['--gap' as string]: 'var(--sp-2)' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 56 }} />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <EmptyState
          icono={Building2}
          titulo="Sin resultados"
          texto={`No encontramos municipios que coincidan con "${busqueda}". Revisa la escritura o busca por departamento.`}
          acciones={
            <button type="button" className="btn btn--soft" onClick={() => setBusqueda('')}>
              <span>Ver todos</span>
            </button>
          }
        />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--sp-2)' }}>
          {filtradas.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="navlink"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => elegir(c.slug)}
              >
                <MapPin size={17} strokeWidth={2.1} />
                <span style={{ display: 'block' }}>
                  <span style={{ display: 'block', color: 'var(--text)', fontWeight: 650 }}>
                    {c.nombre}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-subtle)',
                      fontWeight: 500,
                    }}
                  >
                    {c.departamento}
                  </span>
                </span>
                {c.distanciaKm != null && (
                  <span
                    className="num"
                    style={{
                      marginInlineStart: 'auto',
                      flexShrink: 0,
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                    }}
                  >
                    {formatearDistancia(c.distanciaKm)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
