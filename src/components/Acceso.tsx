import { useState } from 'react'
import { KeyRound, LogOut, Mail, Phone, ShieldCheck } from 'lucide-react'
import { Sheet, Notice } from './ui'
import { useSesion } from '@/state/sesion'

/**
 * Acceso por código de un solo uso.
 *
 * Dos pasos: correo -> código de 6 dígitos. Se usa el código y no el enlace
 * mágico porque el enlace exige que el origen esté dado de alta en las
 * "Redirect URLs" del proyecto, y eso rompe en desarrollo y en cada despliegue
 * nuevo. El código llega en el mismo correo y funciona desde cualquier sitio.
 */
export function Acceso({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const { enviarCodigo, verificarCodigo } = useSesion()

  const [paso, setPaso] = useState<'correo' | 'codigo'>('correo')
  const [correo, setCorreo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  function cerrarYReiniciar() {
    alCerrar()
    // Se reinicia con retardo para que el usuario no vea el formulario saltar
    // al paso 1 mientras la hoja todavía se está cerrando.
    window.setTimeout(() => {
      setPaso('correo')
      setCodigo('')
      setError(null)
    }, 250)
  }

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOcupado(true)
    try {
      if (paso === 'correo') {
        await enviarCodigo(correo)
        setPaso('codigo')
      } else {
        await verificarCodigo(correo, codigo)
        cerrarYReiniciar()
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Sheet
      abierta={abierto}
      alCerrar={cerrarYReiniciar}
      titulo="Entrar"
      subtitulo={
        paso === 'correo'
          ? 'Solo para ver los teléfonos de contacto de los centros.'
          : `Te enviamos un código a ${correo}`
      }
      pie={
        <>
          <button type="button" className="btn" onClick={cerrarYReiniciar}>
            <span>Cancelar</span>
          </button>
          <button
            type="submit"
            form="form-acceso"
            className="btn btn--primary"
            disabled={ocupado || (paso === 'correo' ? !correo.includes('@') : codigo.length < 6)}
          >
            <span>
              {ocupado
                ? 'Un momento…'
                : paso === 'correo'
                  ? 'Enviarme el código'
                  : 'Entrar'}
            </span>
          </button>
        </>
      }
    >
      <form id="form-acceso" onSubmit={alEnviar} className="stack">
        <Notice tono="info" icono={Phone}>
          Todo lo demás —centros, direcciones, qué falta y cómo llegar— se ve sin entrar. Entrar
          solo añade el teléfono de cada centro.
        </Notice>

        {paso === 'correo' ? (
          <div className="field">
            <label className="field__label" htmlFor="acceso-correo">
              Tu correo
            </label>
            <input
              id="acceso-correo"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nombre@correo.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
            <span className="field__hint">
              Te llega un código de 6 dígitos. No hay contraseña que recordar.
            </span>
          </div>
        ) : (
          <div className="field">
            <label className="field__label" htmlFor="acceso-codigo">
              Código de 6 dígitos
            </label>
            <input
              id="acceso-codigo"
              className="input num"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              required
              style={{ fontSize: '1.5rem', letterSpacing: '0.35em', textAlign: 'center' }}
            />
            <span className="field__hint">
              Revisa también la carpeta de correo no deseado. El código caduca en unos minutos.
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setPaso('correo')
                setCodigo('')
                setError(null)
              }}
              style={{ alignSelf: 'flex-start' }}
            >
              <span>Usar otro correo</span>
            </button>
          </div>
        )}

        {error && <Notice tono="critical">{error}</Notice>}
      </form>
    </Sheet>
  )
}

/** Botón de la barra lateral / superior: entra o muestra quién está dentro. */
export function BotonAcceso({ compacto }: { compacto?: boolean }) {
  const { sesion, correo, salir, cargando } = useSesion()
  const [abierto, setAbierto] = useState(false)

  if (cargando) {
    return <div className="skeleton" style={{ height: compacto ? 42 : 40, width: compacto ? 42 : '100%' }} />
  }

  if (sesion) {
    return (
      <button
        type="button"
        className={compacto ? 'btn btn--ghost btn--icon' : 'btn btn--ghost'}
        onClick={salir}
        title={correo ? `Salir de ${correo}` : 'Salir'}
        aria-label="Salir de la sesión"
      >
        <LogOut size={18} />
        {!compacto && <span>Salir</span>}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className={compacto ? 'btn btn--ghost btn--icon' : 'btn btn--soft'}
        onClick={() => setAbierto(true)}
        aria-label="Entrar para ver teléfonos"
        title="Entrar para ver teléfonos"
      >
        <KeyRound size={18} />
        {!compacto && <span>Entrar</span>}
      </button>
      <Acceso abierto={abierto} alCerrar={() => setAbierto(false)} />
    </>
  )
}

/** Aviso reutilizable: explica qué se gana entrando, sin bloquear nada. */
export function AvisoTelefonos() {
  const { sesion, cargando } = useSesion()
  const [abierto, setAbierto] = useState(false)

  if (sesion || cargando) return null

  return (
    <>
      <div className="notice notice--info">
        <ShieldCheck size={17} strokeWidth={2.25} />
        <div className="notice__text">
          <strong>Estás viendo sin entrar.</strong> Solo faltan los teléfonos de los centros; el
          resto de la información está completa.
        </div>
        <button type="button" className="btn btn--sm" onClick={() => setAbierto(true)}>
          <Mail size={15} />
          <span>Entrar</span>
        </button>
      </div>
      <Acceso abierto={abierto} alCerrar={() => setAbierto(false)} />
    </>
  )
}
