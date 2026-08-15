import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Sheet, Notice, AvisoError } from '../ui'
import { Campo, CampoTexto, CampoArea } from './Campos'
import { publicarInmueble, type BorradorInmueble } from '@/backends/vivienda'

/**
 * Publicar una vivienda en arriendo.
 *
 * Pide lo mínimo con lo que alguien puede decidir si le sirve y llamar: qué es,
 * dónde, cuántas habitaciones y a quién escribir. Todo lo demás —estrato, área,
 * administración, código— está vacío en las 30 publicaciones que ya existen, así
 * que pedirlo sería inventar un formulario que nadie rellena.
 *
 * El precio es opcional a propósito: dos tercios de los anuncios actuales lo
 * escriben dentro del texto en vez de en su campo. Obligarlo aquí produciría
 * datos más limpios pero también anuncios que nadie termina de publicar, y en
 * este momento hace más falta el techo que la base de datos ordenada.
 */

const TIPOS = ['Apartamento', 'Casa', 'Apartaestudio', 'Habitación', 'Finca'] as const

interface Props {
  abierto: boolean
  alCerrar: () => void
  alPublicar: () => void
  ciudadesConocidas: string[]
}

export function PublicarVivienda({ abierto, alCerrar, alPublicar, ciudadesConocidas }: Props) {
  const [b, setB] = useState<BorradorInmueble>({
    titulo: '',
    descripcion: '',
    tipo: 'Apartamento',
    ciudad: ciudadesConocidas[0] ?? '',
    barrio: '',
    precio: null,
    habitaciones: 1,
    banos: 1,
    parqueaderos: 0,
    areaM2: null,
    whatsapp: '',
  })

  const publicar = useMutation({
    mutationFn: publicarInmueble,
    onSuccess: () => {
      setB({ ...b, titulo: '', descripcion: '', barrio: '', precio: null, whatsapp: '' })
      alPublicar()
    },
  })

  const listo = b.titulo.trim().length > 4 && b.ciudad.trim() && b.whatsapp.replace(/\D/g, '').length >= 10

  return (
    <Sheet
      abierta={abierto}
      alCerrar={alCerrar}
      titulo="Publicar una vivienda"
      subtitulo="Con esto basta para que alguien decida si le sirve y te escriba."
      pie={
        <>
          <button type="button" className="btn" onClick={alCerrar}>
            <span>Cancelar</span>
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!listo || publicar.isPending}
            onClick={() => publicar.mutate(b)}
          >
            <span>{publicar.isPending ? 'Publicando…' : 'Publicar'}</span>
          </button>
        </>
      }
    >
      <div className="stack">
        {publicar.error ? <AvisoError error={publicar.error} origen="VI" /> : null}

        <Notice tono="info">
          Tu WhatsApp se publica junto al anuncio: es la única forma de que te contacten. No pongas
          aquí ningún otro dato personal.
        </Notice>

        <CampoTexto
          id="viv-titulo"
          etiqueta="Qué ofreces"
          obligatorio
          valor={b.titulo}
          alCambiar={(v) => setB({ ...b, titulo: v })}
          marcador="Apartamento de 2 habitaciones en el norte"
        />

        <Campo id="viv-tipo" etiqueta="Tipo" obligatorio>
          <select
            id="viv-tipo"
            className="input"
            value={b.tipo}
            onChange={(e) => setB({ ...b, tipo: e.target.value })}
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Campo>

        <CampoTexto
          id="viv-ciudad"
          etiqueta="Ciudad"
          obligatorio
          valor={b.ciudad}
          alCambiar={(v) => setB({ ...b, ciudad: v })}
          marcador="Armenia"
          list="viv-ciudades"
        />
        <datalist id="viv-ciudades">
          {ciudadesConocidas.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <CampoTexto
          id="viv-barrio"
          etiqueta="Barrio o sector"
          valor={b.barrio}
          alCambiar={(v) => setB({ ...b, barrio: v })}
          marcador="Providencia"
          ayuda="No pongas la dirección exacta: el barrio basta para que sepan si les queda cerca."
        />

        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {(
            [
              ['habitaciones', 'Habitaciones'],
              ['banos', 'Baños'],
              ['parqueaderos', 'Parqueaderos'],
            ] as const
          ).map(([clave, etiqueta]) => (
            <Campo key={clave} id={`viv-${clave}`} etiqueta={etiqueta}>
              <input
                id={`viv-${clave}`}
                className="input"
                type="number"
                min={0}
                max={20}
                value={b[clave]}
                onChange={(e) => setB({ ...b, [clave]: Math.max(0, Number(e.target.value) || 0) })}
              />
            </Campo>
          ))}
        </div>

        <Campo
          id="viv-precio"
          etiqueta="Canon mensual"
          ayuda="Opcional, pero si lo pones aparecerás en las búsquedas por precio."
        >
          <input
            id="viv-precio"
            className="input"
            type="number"
            min={0}
            step={50000}
            inputMode="numeric"
            placeholder="850000"
            value={b.precio ?? ''}
            onChange={(e) =>
              setB({ ...b, precio: e.target.value ? Number(e.target.value) : null })
            }
          />
        </Campo>

        <CampoArea
          id="viv-desc"
          etiqueta="Detalles"
          valor={b.descripcion}
          alCambiar={(v) => setB({ ...b, descripcion: v })}
          marcador="Qué incluye, si está amoblado, desde cuándo está libre…"
        />

        <CampoTexto
          id="viv-wa"
          etiqueta="Tu WhatsApp"
          obligatorio
          tipo="tel"
          valor={b.whatsapp}
          alCambiar={(v) => setB({ ...b, whatsapp: v })}
          marcador="300 123 4567"
        />
      </div>
    </Sheet>
  )
}
