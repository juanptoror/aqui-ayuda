import { useEffect, useMemo, useState } from 'react'
import { CircleCheck, LocateFixed, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Sheet, Notice } from './ui'
import { usePreferencias } from '@/state/preferencias'
import { obtenerUbicacion } from '@/lib/geo'
import {
  CATEGORIAS_CORAG,
  nuevoExternalId,
  useEmergencias,
  usePublicarAyuda,
  type BorradorAyuda,
  type CategoriaCorag,
  type TipoAyuda,
  type Urgencia,
} from '@/backends/corag'

const ETIQUETA_CATEGORIA: Record<CategoriaCorag, string> = {
  alimentos: 'Alimentos',
  salud: 'Salud y medicamentos',
  refugio: 'Refugio y alojamiento',
  transporte: 'Transporte',
  acopio: 'Centro de acopio',
  rescate: 'Rescate',
  otro: 'Otro',
}

const URGENCIAS: { valor: Urgencia; etiqueta: string; ayuda: string }[] = [
  { valor: 'urgent', etiqueta: 'Urgente', ayuda: 'Hace falta hoy mismo' },
  { valor: 'needed', etiqueta: 'Necesario', ayuda: 'Hace falta en los próximos días' },
  { valor: 'stable', etiqueta: 'Puede esperar', ayuda: 'No es apremiante' },
]

/**
 * Publica una solicitud o un ofrecimiento en la API pública de Corag.
 *
 * Dos decisiones que no son negociables:
 * - El `externalId` se genera UNA vez por formulario. La API deduplica por
 *   `source` + `externalId`, así que reintentar tras un fallo de red reenvía el
 *   mismo identificador y no crea un duplicado. Regenerarlo en cada intento
 *   convertiría un problema de red en publicaciones repetidas.
 * - `publishContact` sale de una casilla que la persona marca a mano. El
 *   teléfono se publica en abierto, así que el consentimiento no se deduce ni
 *   se marca por defecto.
 */
export function PublicarAyuda({
  abierto,
  alCerrar,
  alPublicar,
}: {
  abierto: boolean
  alCerrar: () => void
  alPublicar?: () => void
}) {
  const { ubicacion, fijarUbicacion } = usePreferencias()
  const { data: emergencias } = useEmergencias()
  const publicar = usePublicarAyuda()

  const [tipo, setTipo] = useState<TipoAyuda>('request')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState<CategoriaCorag>('alimentos')
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [direccion, setDireccion] = useState('')
  const [urgencia, setUrgencia] = useState<Urgencia>('needed')
  const [personas, setPersonas] = useState('')
  const [consiente, setConsiente] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  // Un id por apertura del formulario: es la clave de la idempotencia.
  const [externalId, setExternalId] = useState(nuevoExternalId)

  useEffect(() => {
    if (abierto) {
      setExternalId(nuevoExternalId())
      setEnviado(false)
      publicar.reset()
    }
    // `publicar` cambia de identidad en cada render de react-query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  const esSolicitud = tipo === 'request'

  const faltan = useMemo(() => {
    const f: string[] = []
    if (titulo.trim().length < 5) f.push('un título de al menos 5 caracteres')
    if (nombre.trim().length < 2) f.push('tu nombre')
    if (whatsapp.replace(/\D/g, '').length < 8) f.push('un WhatsApp válido')
    if (!consiente) f.push('tu permiso para publicar el contacto')
    if (esSolicitud) {
      if (direccion.trim().length < 3) f.push('la dirección')
      if (!ubicacion) f.push('la ubicación en el mapa')
    }
    return f
  }, [titulo, nombre, whatsapp, consiente, esSolicitud, direccion, ubicacion])

  async function usarUbicacion() {
    setErrorUbicacion(null)
    try {
      fijarUbicacion(await obtenerUbicacion())
    } catch (e) {
      setErrorUbicacion((e as Error).message)
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (faltan.length > 0) return

    const borrador: BorradorAyuda = {
      type: tipo,
      title: titulo,
      description: descripcion,
      category: categoria,
      contactName: nombre,
      contactWhatsapp: whatsapp,
      publishContact: consiente,
      emergencySlug: emergencias?.[0]?.slug,
      ...(esSolicitud
        ? {
            address: direccion,
            latitude: ubicacion?.lat,
            longitude: ubicacion?.lng,
            urgency: urgencia,
            neededPeople: personas ? Number(personas) : undefined,
          }
        : {}),
    }

    try {
      await publicar.mutateAsync({ borrador, externalId })
      setEnviado(true)
      alPublicar?.()
    } catch {
      /* el error se muestra desde publicar.error */
    }
  }

  if (enviado) {
    return (
      <Sheet
        abierta={abierto}
        alCerrar={alCerrar}
        titulo="Publicado"
        subtitulo="Ya aparece en el listado público."
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
              ['--empty-icon-bg' as string]: 'var(--success-soft)',
              ['--empty-icon-fg' as string]: 'var(--success)',
            }}
          >
            <CircleCheck size={26} strokeWidth={2} />
          </span>
          <h3 className="empty__title">Tu publicación ya está en línea</h3>
          <p className="empty__text">
            Quien pueda ayudar te escribirá por WhatsApp. Si se resuelve, avisa para que la
            retiren y nadie repita el esfuerzo.
          </p>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      abierta={abierto}
      alCerrar={alCerrar}
      titulo={esSolicitud ? 'Pedir ayuda' : 'Ofrecer ayuda'}
      subtitulo="Se publica en el listado abierto de Corag. No hace falta registrarse."
      pie={
        <>
          <button type="button" className="btn" onClick={alCerrar}>
            <span>Cancelar</span>
          </button>
          <button
            type="submit"
            form="form-publicar"
            className="btn btn--primary"
            disabled={faltan.length > 0 || publicar.isPending}
          >
            <span>{publicar.isPending ? 'Publicando…' : 'Publicar'}</span>
          </button>
        </>
      }
    >
      <form id="form-publicar" onSubmit={enviar} className="stack">
        <div className="segmented" role="tablist" style={{ ['--seg-count' as string]: '2' }}>
          <button
            type="button"
            role="tab"
            aria-selected={tipo === 'request'}
            className="segmented__option"
            onClick={() => setTipo('request')}
          >
            <span>Necesito algo</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tipo === 'offer'}
            className="segmented__option"
            onClick={() => setTipo('offer')}
          >
            <span>Ofrezco algo</span>
          </button>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="pub-titulo">
            ¿Qué {esSolicitud ? 'necesitas' : 'ofreces'}?
          </label>
          <input
            id="pub-titulo"
            className="input"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={esSolicitud ? 'Colchonetas para 4 personas' : 'Puedo transportar en camioneta'}
            maxLength={120}
            required
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="pub-desc">
            Detalles <span style={{ color: 'var(--text-subtle)', fontWeight: 400 }}>(opcional)</span>
          </label>
          <textarea
            id="pub-desc"
            className="textarea"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Tallas, cantidades, horarios, cualquier cosa que ayude a quien responda."
            maxLength={600}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="pub-cat">
            Categoría
          </label>
          <select
            id="pub-cat"
            className="select"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaCorag)}
          >
            {CATEGORIAS_CORAG.map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CATEGORIA[c]}
              </option>
            ))}
          </select>
        </div>

        {esSolicitud && (
          <>
            <div className="field">
              <label className="field__label" htmlFor="pub-urgencia">
                ¿Para cuándo?
              </label>
              <select
                id="pub-urgencia"
                className="select"
                value={urgencia}
                onChange={(e) => setUrgencia(e.target.value as Urgencia)}
              >
                {URGENCIAS.map((u) => (
                  <option key={u.valor} value={u.valor}>
                    {u.etiqueta} — {u.ayuda}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="pub-dir">
                Dirección
              </label>
              <input
                id="pub-dir"
                className="input"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Barrio, calle y número"
                maxLength={200}
                required
              />
              <span className="field__hint">
                Se publica para que quien ayude sepa a dónde ir.
              </span>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="pub-personas">
                ¿Cuántas personas?{' '}
                <span style={{ color: 'var(--text-subtle)', fontWeight: 400 }}>(opcional)</span>
              </label>
              <input
                id="pub-personas"
                className="input num"
                type="number"
                min={1}
                max={9999}
                value={personas}
                onChange={(e) => setPersonas(e.target.value)}
                placeholder="4"
              />
            </div>

            {ubicacion ? (
              <Notice tono="info" icono={LocateFixed}>
                Ubicación lista. Se enviará para que aparezcas en el mapa y la gente sepa qué tan
                cerca estás.
              </Notice>
            ) : (
              <Notice
                tono="warning"
                accion={
                  <button type="button" className="btn btn--sm" onClick={usarUbicacion}>
                    <span>Usar mi ubicación</span>
                  </button>
                }
              >
                Una solicitud necesita ubicación en el mapa.
                {errorUbicacion ? ` ${errorUbicacion}` : ''}
              </Notice>
            )}
          </>
        )}

        <hr className="hr" />

        <div className="field">
          <label className="field__label" htmlFor="pub-nombre">
            Tu nombre
          </label>
          <input
            id="pub-nombre"
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="name"
            maxLength={80}
            required
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="pub-wa">
            WhatsApp
          </label>
          <input
            id="pub-wa"
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+57 300 000 0000"
            maxLength={25}
            required
          />
        </div>

        {/* El consentimiento es una decisión explícita: nunca viene marcado. */}
        <label
          className="panel panel--inset"
          style={{
            display: 'flex',
            gap: 'var(--sp-3)',
            padding: 'var(--sp-4)',
            cursor: 'pointer',
            alignItems: 'flex-start',
          }}
        >
          <input
            type="checkbox"
            checked={consiente}
            onChange={(e) => setConsiente(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0, cursor: 'pointer' }}
          />
          <span className="min0">
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 650,
                marginBottom: 2,
              }}
            >
              <ShieldCheck size={15} />
              Autorizo publicar mi nombre y mi WhatsApp
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Quedan visibles para cualquiera que entre. Es la única forma de que puedan
              escribirte, pero la decisión es tuya.
            </span>
          </span>
        </label>

        {publicar.error && (
          <Notice tono="critical" icono={TriangleAlert}>
            {(publicar.error as Error).message}
          </Notice>
        )}

        {faltan.length > 0 && (
          <p style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Para publicar falta: {faltan.join(', ')}.
          </p>
        )}
      </form>
    </Sheet>
  )
}
