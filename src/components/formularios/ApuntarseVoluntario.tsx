import { useEffect, useMemo, useState } from 'react'
import { CircleCheck, KeyRound } from 'lucide-react'
import { Sheet, AvisoError, Notice } from '../ui'
import { CampoArea, CampoTexto, GrupoMultiple, QueFalta } from './Campos'
import { useApuntarseVoluntario } from '@/datos/consultas'
import { useSesion } from '@/state/sesion'
import { FRANJAS_DISPONIBILIDAD, TAREAS_VOLUNTARIO } from '@/dominio/modelos'

/**
 * "Quiero ser voluntario".
 *
 * Exige sesión porque el registro guarda a quién pertenece la inscripción. Se
 * avisa ANTES de que la persona rellene todo, no después de pulsar enviar:
 * escribir seis campos para que te digan que no puedes es la peor forma de
 * descubrirlo.
 */
export function ApuntarseVoluntario({
  abierto,
  alCerrar,
  ciudadId,
  ciudadNombre,
  centroId,
  alPedirAcceso,
}: {
  abierto: boolean
  alCerrar: () => void
  ciudadId: string
  ciudadNombre: string
  centroId?: string | null
  alPedirAcceso: () => void
}) {
  const { sesion } = useSesion()
  const apuntarse = useApuntarseVoluntario()

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [tareas, setTareas] = useState<string[]>([])
  const [franjas, setFranjas] = useState<string[]>([])
  const [notas, setNotas] = useState('')
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setEnviado(false)
    apuntarse.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  const faltan = useMemo(() => {
    const f: string[] = []
    if (nombre.trim().length < 2) f.push('tu nombre')
    if (telefono.replace(/\D/g, '').length < 7) f.push('tu teléfono')
    if (tareas.length === 0) f.push('en qué puedes ayudar')
    return f
  }, [nombre, telefono, tareas])

  function alternar(lista: string[], fijar: (v: string[]) => void, valor: string) {
    fijar(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor])
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (faltan.length > 0) return
    try {
      await apuntarse.mutateAsync({
        ciudadId,
        centroId: centroId ?? null,
        nombre,
        telefono,
        puedeAyudarEn: tareas,
        disponibilidad: franjas.length > 0 ? franjas : ['A cualquier hora'],
        notas,
      })
      setEnviado(true)
    } catch {
      /* mostrado desde apuntarse.error */
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
          <h3 className="empty__title">Gracias, ya estás apuntado</h3>
          <p className="empty__text">
            Los coordinadores te llaman cuando necesiten manos en un centro cerca de ti. No hace
            falta que hagas nada más.
          </p>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      abierta={abierto}
      alCerrar={alCerrar}
      titulo="Quiero ser voluntario"
      subtitulo={`Quedas en la lista de quien puede ayudar en ${ciudadNombre}. Los coordinadores te llaman cuando necesiten manos en un centro cerca de ti.`}
      pie={
        <>
          <button type="button" className="btn" onClick={alCerrar}>
            <span>Cancelar</span>
          </button>
          {sesion ? (
            <button
              type="submit"
              form="form-voluntario"
              className="btn btn--primary"
              disabled={faltan.length > 0 || apuntarse.isPending}
            >
              <span>{apuntarse.isPending ? 'Enviando…' : 'Inscribirme'}</span>
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
            Para apuntarte hace falta entrar con tu correo: así los coordinadores saben que la
            inscripción es tuya y pueden avisarte. Te llega un código, sin contraseña.
          </Notice>
        </div>
      )}

      <form id="form-voluntario" onSubmit={enviar} className="stack">
        <CampoTexto
          id="vol-nombre"
          etiqueta="Tu nombre"
          obligatorio
          valor={nombre}
          alCambiar={setNombre}
          maximo={80}
          disabled={!sesion}
        />

        <CampoTexto
          id="vol-tel"
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

        <GrupoMultiple
          etiqueta="¿En qué puedes ayudar?"
          opciones={TAREAS_VOLUNTARIO}
          seleccionadas={tareas}
          alAlternar={(o) => alternar(tareas, setTareas, o)}
          ayuda="Toca todas las que puedas."
        />

        <GrupoMultiple
          etiqueta="¿Cuándo puedes?"
          opciones={FRANJAS_DISPONIBILIDAD}
          seleccionadas={franjas}
          alAlternar={(o) => alternar(franjas, setFranjas, o)}
          ayuda="Si no marcas ninguna, entendemos que a cualquier hora."
        />

        <CampoArea
          id="vol-notas"
          etiqueta="Algo más que debamos saber"
          valor={notas}
          alCambiar={setNotas}
          marcador="Nada en especial"
          maximo={300}
        />

        {apuntarse.error ? <AvisoError error={apuntarse.error} origen="AP" /> : null}
        {sesion && <QueFalta faltan={faltan} />}
      </form>
    </Sheet>
  )
}
