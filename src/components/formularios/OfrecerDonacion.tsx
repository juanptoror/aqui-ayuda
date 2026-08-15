import { useEffect, useMemo, useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { Sheet, AvisoError } from '../ui'
import { Alternativa, CampoArea, CampoTexto, QueFalta } from './Campos'
import { useOfrecerDonacion } from '@/datos/consultas'
import { CATEGORIAS, type Necesidad } from '@/dominio/modelos'

/**
 * "Tengo algo para donar".
 *
 * Sirve para los dos casos que existen en la app y que son el mismo formulario:
 * ofrecer algo a la ciudad en general, u ofrecer algo contra una necesidad
 * concreta de un centro. La diferencia es qué se rellena solo y qué texto se
 * muestra arriba, no un segundo componente.
 */
export function OfrecerDonacion({
  abierto,
  alCerrar,
  ciudadId,
  ciudadNombre,
  /** Si se ofrece contra una necesidad concreta. */
  necesidad,
  centroId,
  centroNombre,
}: {
  abierto: boolean
  alCerrar: () => void
  ciudadId: string
  ciudadNombre: string
  necesidad?: Necesidad | null
  centroId?: string | null
  centroNombre?: string | null
}) {
  const ofrecer = useOfrecerDonacion()

  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0])
  const [descripcion, setDescripcion] = useState('')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [entrega, setEntrega] = useState<'recogen' | 'llevo'>('llevo')
  const [direccion, setDireccion] = useState('')
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setEnviado(false)
    ofrecer.reset()
    // Al nacer de una necesidad, la categoría ya está decidida.
    setCategoria(necesidad?.categoria ?? CATEGORIAS[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, necesidad?.id])

  const faltan = useMemo(() => {
    const f: string[] = []
    if (descripcion.trim().length < 3) f.push('qué puedes aportar')
    if (nombre.trim().length < 2) f.push('tu nombre')
    if (telefono.replace(/\D/g, '').length < 7) f.push('tu teléfono')
    if (entrega === 'recogen' && direccion.trim().length < 3) f.push('dónde se recoge')
    return f
  }, [descripcion, nombre, telefono, entrega, direccion])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (faltan.length > 0) return
    try {
      await ofrecer.mutateAsync({
        ciudadId,
        centroId: centroId ?? null,
        necesidadId: necesidad?.id ?? null,
        categoria,
        descripcion,
        nombre,
        telefono,
        necesitaTransporte: entrega === 'recogen',
        direccionRecogida: direccion,
      })
      setEnviado(true)
    } catch {
      /* el error se muestra desde ofrecer.error, ya traducido */
    }
  }

  const titulo = necesidad ? `Yo tengo ${necesidad.categoria.toLowerCase()}` : 'Quiero donar algo'

  if (enviado) {
    return (
      <Sheet
        abierta={abierto}
        alCerrar={alCerrar}
        titulo="Gracias"
        pie={
          <button type="button" className="btn btn--primary" onClick={alCerrar}>
            <span>Cerrar</span>
          </button>
        }
      >
        <div className="empty">
          <span
            className="empty__icon"
            style={{
              ['--empty-icon-bg' as string]: 'var(--success-solid)',
              ['--empty-icon-fg' as string]: '#000',
            }}
          >
            <CircleCheck size={26} strokeWidth={2} />
          </span>
          <h3 className="empty__title">Tu ofrecimiento quedó publicado</h3>
          <p className="empty__text">
            {entrega === 'recogen'
              ? 'Un coordinador te llamará para cuadrar la recogida. Ten el teléfono a mano.'
              : 'Un coordinador te llamará para decirte cuándo y dónde llevarlo.'}
          </p>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      abierta={abierto}
      alCerrar={alCerrar}
      titulo={titulo}
      subtitulo={
        necesidad
          ? `Para ${centroNombre ?? 'este centro'} — ${necesidad.descripcion ?? necesidad.categoria}`
          : `Publica lo que tienes en ${ciudadNombre}. Los centros que lo necesiten lo reclamarán, y si no puedes llevarlo, un voluntario pasa a recogerlo.`
      }
      pie={
        <>
          <button type="button" className="btn" onClick={alCerrar}>
            <span>Cancelar</span>
          </button>
          <button
            type="submit"
            form="form-donar"
            className="btn btn--primary"
            disabled={faltan.length > 0 || ofrecer.isPending}
          >
            <span>{ofrecer.isPending ? 'Enviando…' : 'Ofrecer'}</span>
          </button>
        </>
      }
    >
      <form id="form-donar" onSubmit={enviar} className="stack">
        {!necesidad && (
          <div className="field">
            <label className="field__label" htmlFor="donar-cat">
              ¿Qué tipo de ayuda es?
            </label>
            <select
              id="donar-cat"
              className="select"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        <CampoArea
          id="donar-desc"
          etiqueta="¿Qué puedes aportar?"
          obligatorio
          valor={descripcion}
          alCambiar={setDescripcion}
          marcador="Ej. 20 paquetes de pañales etapa 3"
        />

        <CampoTexto
          id="donar-nombre"
          etiqueta="Tu nombre"
          obligatorio
          valor={nombre}
          alCambiar={setNombre}
          maximo={80}
        />

        <CampoTexto
          id="donar-tel"
          etiqueta="Tu teléfono"
          obligatorio
          tipo="tel"
          valor={telefono}
          alCambiar={setTelefono}
          marcador="3001234567"
          maximo={20}
          ayuda="Solo lo ven los coordinadores, para llamarte y cuadrar."
        />

        <Alternativa
          etiqueta="¿Cómo llega al centro?"
          valor={entrega}
          alElegir={setEntrega}
          opciones={[
            { valor: 'llevo', texto: 'Yo lo llevo' },
            { valor: 'recogen', texto: 'Necesito que lo recojan' },
          ]}
        />

        {entrega === 'recogen' && (
          <CampoTexto
            id="donar-dir"
            etiqueta="¿Dónde se recoge?"
            obligatorio
            valor={direccion}
            alCambiar={setDireccion}
            marcador="Ej. Barrio Álamos, Cra. 30 #12-40"
            maximo={200}
            ayuda="Barrio y dirección, para que el voluntario sepa a dónde ir."
          />
        )}

        {ofrecer.error ? <AvisoError error={ofrecer.error} origen="AP" /> : null}
        <QueFalta faltan={faltan} />
      </form>
    </Sheet>
  )
}
