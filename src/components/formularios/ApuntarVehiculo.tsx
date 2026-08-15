import { useEffect, useMemo, useState } from 'react'
import { CircleCheck, KeyRound } from 'lucide-react'
import { Sheet, AvisoError, Notice } from '../ui'
import { CampoTexto, QueFalta } from './Campos'
import { useApuntarVehiculo } from '@/datos/consultas'
import { useSesion } from '@/state/sesion'

/**
 * "Pongo mi carro".
 *
 * El transporte es el cuello de botella real: hay donaciones paradas porque
 * nadie puede moverlas. Por eso este formulario es corto —cuatro campos— y no
 * pide nada que no sirva para llamar a la persona.
 */
export function ApuntarVehiculo({
  abierto,
  alCerrar,
  ciudadId,
  ciudadNombre,
  alPedirAcceso,
}: {
  abierto: boolean
  alCerrar: () => void
  ciudadId: string
  ciudadNombre: string
  alPedirAcceso: () => void
}) {
  const { sesion } = useSesion()
  const apuntar = useApuntarVehiculo()

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [vehiculo, setVehiculo] = useState('')
  const [capacidad, setCapacidad] = useState('')
  const [zona, setZona] = useState('')
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setEnviado(false)
    apuntar.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  const faltan = useMemo(() => {
    const f: string[] = []
    if (nombre.trim().length < 2) f.push('tu nombre')
    if (telefono.replace(/\D/g, '').length < 7) f.push('tu teléfono')
    if (vehiculo.trim().length < 2) f.push('qué vehículo tienes')
    return f
  }, [nombre, telefono, vehiculo])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (faltan.length > 0) return
    try {
      await apuntar.mutateAsync({ ciudadId, nombre, telefono, vehiculo, capacidad, zona })
      setEnviado(true)
    } catch {
      /* mostrado desde apuntar.error */
    }
  }

  if (enviado) {
    return (
      <Sheet
        abierta={abierto}
        alCerrar={alCerrar}
        titulo="Quedaste en la lista"
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
          <h3 className="empty__title">Tu vehículo está apuntado</h3>
          <p className="empty__text">
            Los coordinadores te llaman cuando haya un encargo cerca de ti.
          </p>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      abierta={abierto}
      alCerrar={alCerrar}
      titulo="Pongo mi carro"
      subtitulo={`Quedas en la lista de quien puede mover cosas en ${ciudadNombre}. Los coordinadores te llaman cuando haya un encargo cerca de ti.`}
      pie={
        <>
          <button type="button" className="btn" onClick={alCerrar}>
            <span>Cancelar</span>
          </button>
          {sesion ? (
            <button
              type="submit"
              form="form-vehiculo"
              className="btn btn--primary"
              disabled={faltan.length > 0 || apuntar.isPending}
            >
              <span>{apuntar.isPending ? 'Enviando…' : 'Inscribirme'}</span>
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={alPedirAcceso}>
              <KeyRound size={18} />
              <span>Entrar para inscribirme</span>
            </button>
          )}
        </>
      }
    >
      {!sesion && (
        <div className="stack" style={{ marginBottom: 'var(--sp-5)' }}>
          <Notice tono="warning" icono={KeyRound}>
            Para apuntar tu vehículo hace falta entrar con tu correo. Te llega un código, sin
            contraseña.
          </Notice>
        </div>
      )}

      <form id="form-vehiculo" onSubmit={enviar} className="stack">
        <CampoTexto
          id="veh-nombre"
          etiqueta="Tu nombre"
          obligatorio
          valor={nombre}
          alCambiar={setNombre}
          maximo={80}
          disabled={!sesion}
        />
        <CampoTexto
          id="veh-tel"
          etiqueta="Tu teléfono"
          obligatorio
          tipo="tel"
          valor={telefono}
          alCambiar={setTelefono}
          marcador="3001234567"
          maximo={20}
          ayuda="Solo lo ven quienes entraron con su correo."
          disabled={!sesion}
        />
        <CampoTexto
          id="veh-vehiculo"
          etiqueta="¿Qué vehículo tienes?"
          obligatorio
          valor={vehiculo}
          alCambiar={setVehiculo}
          marcador="Ej. Camioneta platón, moto, camión NPR"
          maximo={120}
          disabled={!sesion}
        />
        <CampoTexto
          id="veh-capacidad"
          etiqueta="¿Cuánto cabe?"
          valor={capacidad}
          alCambiar={setCapacidad}
          marcador="Ej. 15 cajas, media tonelada"
          maximo={120}
          disabled={!sesion}
        />
        <CampoTexto
          id="veh-zona"
          etiqueta="¿Por dónde te mueves?"
          valor={zona}
          alCambiar={setZona}
          marcador="Ej. Centro y Cuba"
          maximo={120}
          disabled={!sesion}
        />

        {apuntar.error ? <AvisoError error={apuntar.error} origen="AP" /> : null}
        {sesion && <QueFalta faltan={faltan} />}
      </form>
    </Sheet>
  )
}
