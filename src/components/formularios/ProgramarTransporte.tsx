import { useEffect, useMemo, useState } from 'react'
import { CircleCheck, KeyRound } from 'lucide-react'
import { Sheet, AvisoError, Notice } from '../ui'
import { Campo, CampoArea, CampoTexto, QueFalta } from './Campos'
import { useProgramarTransporte } from '@/datos/consultas'
import { useSesion } from '@/state/sesion'
import type { Centro, ItemInventario } from '@/dominio/modelos'

/**
 * "Nuevo transporte": mover carga de un centro a otro.
 *
 * Lo que hace útil este formulario es que la carga se elige del inventario REAL
 * del origen. Escribirla a mano invita a programar un viaje por algo que ya no
 * está, y en emergencia un camión perdido es un día perdido.
 */
export function ProgramarTransporte({
  abierto,
  alCerrar,
  ciudadId,
  centros,
  inventario,
  alPedirAcceso,
}: {
  abierto: boolean
  alCerrar: () => void
  ciudadId: string
  centros: Centro[]
  inventario: ItemInventario[]
  alPedirAcceso: () => void
}) {
  const { sesion } = useSesion()
  const programar = useProgramarTransporte()

  const [origenId, setOrigenId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [carga, setCarga] = useState('')
  const [extra, setExtra] = useState('')
  const [vehiculo, setVehiculo] = useState('')
  const [conductor, setConductor] = useState('')
  const [telefono, setTelefono] = useState('')
  const [salida, setSalida] = useState('')
  const [notas, setNotas] = useState('')
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setEnviado(false)
    programar.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  // Cambiar de origen invalida la carga elegida del origen anterior.
  useEffect(() => {
    setCarga('')
  }, [origenId])

  const disponibleEnOrigen = useMemo(
    () => inventario.filter((i) => i.centroId === origenId && i.cantidad > 0),
    [inventario, origenId],
  )

  const faltan = useMemo(() => {
    const f: string[] = []
    if (!origenId) f.push('de dónde sale')
    if (!destinoId) f.push('a dónde va')
    if (!carga.trim() && !extra.trim()) f.push('qué lleva')
    if (origenId && destinoId && origenId === destinoId) f.push('un destino distinto del origen')
    return f
  }, [origenId, destinoId, carga, extra])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (faltan.length > 0) return
    try {
      await programar.mutateAsync({
        ciudadId,
        origenId,
        destinoId,
        destinoTexto: '',
        carga: [carga, extra].filter((t) => t.trim()).join(' · '),
        vehiculo,
        conductor,
        telefono,
        // El campo del navegador da hora local; el backend espera ISO.
        salida: salida ? new Date(salida).toISOString() : null,
        notas,
      })
      setEnviado(true)
    } catch {
      /* mostrado desde programar.error */
    }
  }

  if (enviado) {
    return (
      <Sheet
        abierta={abierto}
        alCerrar={alCerrar}
        titulo="Transporte programado"
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
          <h3 className="empty__title">Ya está en la lista</h3>
          <p className="empty__text">
            Aparece como programado. Cuando salga, quien coordine puede marcarlo en ruta.
          </p>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      abierta={abierto}
      alCerrar={alCerrar}
      titulo="Nuevo transporte"
      subtitulo="Mover carga de un centro a otro. La carga se elige de lo que hay de verdad en el origen."
      pie={
        <>
          <button type="button" className="btn" onClick={alCerrar}>
            <span>Cancelar</span>
          </button>
          {sesion ? (
            <button
              type="submit"
              form="form-transporte"
              className="btn btn--primary"
              disabled={faltan.length > 0 || programar.isPending}
            >
              <span>{programar.isPending ? 'Programando…' : 'Programar'}</span>
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={alPedirAcceso}>
              <KeyRound size={18} />
              <span>Entrar para programar</span>
            </button>
          )}
        </>
      }
    >
      {!sesion && (
        <div className="stack" style={{ marginBottom: 'var(--sp-5)' }}>
          <Notice tono="warning" icono={KeyRound}>
            Programar transportes es cosa de coordinación, así que hace falta entrar con tu correo.
          </Notice>
        </div>
      )}

      <form id="form-transporte" onSubmit={enviar} className="stack">
        <Campo id="tr-origen" etiqueta="Sale de" obligatorio>
          <select
            id="tr-origen"
            className="select"
            value={origenId}
            onChange={(e) => setOrigenId(e.target.value)}
            disabled={!sesion}
          >
            <option value="">Selecciona un centro…</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo id="tr-destino" etiqueta="Va hacia" obligatorio>
          <select
            id="tr-destino"
            className="select"
            value={destinoId}
            onChange={(e) => setDestinoId(e.target.value)}
            disabled={!sesion}
          >
            <option value="">Selecciona un centro…</option>
            {centros
              .filter((c) => c.id !== origenId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
          </select>
        </Campo>

        <Campo
          id="tr-carga"
          etiqueta="Qué lleva"
          obligatorio
          ayuda={
            !origenId
              ? 'Elige primero de dónde sale, para ver qué hay disponible.'
              : disponibleEnOrigen.length === 0
                ? 'Ese centro no tiene existencias registradas. Usa el campo de abajo.'
                : 'Se listan las existencias registradas en el origen.'
          }
        >
          <select
            id="tr-carga"
            className="select"
            value={carga}
            onChange={(e) => setCarga(e.target.value)}
            disabled={!sesion || !origenId || disponibleEnOrigen.length === 0}
          >
            <option value="">
              {origenId ? 'Elige qué se lleva…' : 'Elige primero el origen'}
            </option>
            {disponibleEnOrigen.map((i) => (
              <option key={i.id} value={`${i.cantidad} ${i.unidad} de ${i.categoria}`}>
                {i.cantidad} {i.unidad} — {i.categoria}
              </option>
            ))}
          </select>
        </Campo>

        <CampoTexto
          id="tr-extra"
          etiqueta="Algo más que no esté en la lista"
          valor={extra}
          alCambiar={setExtra}
          marcador="Ej. 3 colchonetas prestadas"
          maximo={200}
          ayuda="Opcional. Lo que se escriba aquí no descuenta inventario."
          disabled={!sesion}
        />

        <CampoTexto
          id="tr-vehiculo"
          etiqueta="Vehículo"
          valor={vehiculo}
          alCambiar={setVehiculo}
          marcador="Ej. Camión NPR — WXY 456"
          maximo={120}
          disabled={!sesion}
        />

        <CampoTexto
          id="tr-conductor"
          etiqueta="Conductor"
          valor={conductor}
          alCambiar={setConductor}
          maximo={80}
          disabled={!sesion}
        />

        <CampoTexto
          id="tr-tel"
          etiqueta="Teléfono del conductor"
          tipo="tel"
          valor={telefono}
          alCambiar={setTelefono}
          marcador="3001234567"
          maximo={20}
          disabled={!sesion}
        />

        <Campo
          id="tr-salida"
          etiqueta="Hora de salida"
          ayuda="Opcional. Si lo dejas vacío se registra al marcarlo en ruta."
        >
          <input
            id="tr-salida"
            className="input"
            type="datetime-local"
            value={salida}
            onChange={(e) => setSalida(e.target.value)}
            disabled={!sesion}
          />
        </Campo>

        <CampoArea
          id="tr-notas"
          etiqueta="Notas"
          valor={notas}
          alCambiar={setNotas}
          maximo={300}
        />

        {programar.error ? <AvisoError error={programar.error} origen="AP" /> : null}
        {sesion && <QueFalta faltan={faltan} />}
      </form>
    </Sheet>
  )
}
