import type { ReactNode } from 'react'

/**
 * Piezas de formulario compartidas por los cuatro flujos de participación
 * (donar, voluntario, vehículo, transporte). Existen para que los cuatro se
 * comporten igual: mismo aspecto, mismas etiquetas de obligatorio y mismos
 * textos de ayuda, sin repetir el marcado cuatro veces.
 */

export function Campo({
  id,
  etiqueta,
  obligatorio,
  ayuda,
  children,
}: {
  id: string
  etiqueta: string
  obligatorio?: boolean
  ayuda?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {etiqueta}
        {obligatorio && (
          <span aria-hidden="true" style={{ color: 'var(--critical)' }}>
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {ayuda && <span className="field__hint">{ayuda}</span>}
    </div>
  )
}

export function CampoTexto({
  id,
  etiqueta,
  valor,
  alCambiar,
  marcador,
  ayuda,
  obligatorio,
  tipo = 'text',
  maximo = 160,
  ...resto
}: {
  id: string
  etiqueta: string
  valor: string
  alCambiar: (v: string) => void
  marcador?: string
  ayuda?: ReactNode
  obligatorio?: boolean
  tipo?: 'text' | 'tel' | 'email'
  maximo?: number
} & Record<string, unknown>) {
  return (
    <Campo id={id} etiqueta={etiqueta} obligatorio={obligatorio} ayuda={ayuda}>
      <input
        id={id}
        className="input"
        type={tipo}
        inputMode={tipo === 'tel' ? 'tel' : undefined}
        autoComplete={tipo === 'tel' ? 'tel' : undefined}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        placeholder={marcador}
        maxLength={maximo}
        required={obligatorio}
        {...resto}
      />
    </Campo>
  )
}

export function CampoArea({
  id,
  etiqueta,
  valor,
  alCambiar,
  marcador,
  ayuda,
  obligatorio,
  maximo = 500,
}: {
  id: string
  etiqueta: string
  valor: string
  alCambiar: (v: string) => void
  marcador?: string
  ayuda?: ReactNode
  obligatorio?: boolean
  maximo?: number
}) {
  return (
    <Campo id={id} etiqueta={etiqueta} obligatorio={obligatorio} ayuda={ayuda}>
      <textarea
        id={id}
        className="textarea"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        placeholder={marcador}
        maxLength={maximo}
        required={obligatorio}
      />
    </Campo>
  )
}

/**
 * Un bloque del formulario que NO es un control con etiqueta, sino un grupo:
 * un botón y su resultado, unas miniaturas y su botón de añadir.
 *
 * Existe porque usar `Campo` para esto es un error silencioso: su `<label
 * for="…">` apuntando a un `<button>` convierte el texto de la etiqueta en el
 * nombre accesible del botón, y un lector de pantalla acaba anunciando "Dónde
 * está" en lugar de "Usar mi ubicación". `fieldset` + `legend` describe el
 * grupo sin robarle el nombre a nada de dentro.
 */
export function CampoGrupo({
  etiqueta,
  obligatorio,
  ayuda,
  children,
}: {
  etiqueta: string
  obligatorio?: boolean
  ayuda?: ReactNode
  children: ReactNode
}) {
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="field__label" style={{ padding: 0 }}>
        {etiqueta}
        {obligatorio && (
          <span aria-hidden="true" style={{ color: 'var(--critical)' }}>
            {' '}
            *
          </span>
        )}
      </legend>
      {children}
      {ayuda && (
        <span className="field__hint" style={{ display: 'block', marginTop: 'var(--sp-2)' }}>
          {ayuda}
        </span>
      )}
    </fieldset>
  )
}

/** Grupo de opciones donde se puede marcar más de una. */
export function GrupoMultiple({
  etiqueta,
  opciones,
  seleccionadas,
  alAlternar,
  ayuda,
}: {
  etiqueta: string
  opciones: readonly string[]
  seleccionadas: string[]
  alAlternar: (opcion: string) => void
  ayuda?: ReactNode
}) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="field__label" style={{ padding: 0, marginBottom: 'var(--sp-2)' }}>
        {etiqueta}
      </legend>
      <div className="chips">
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            className="chip"
            aria-pressed={seleccionadas.includes(o)}
            onClick={() => alAlternar(o)}
          >
            <span>{o}</span>
          </button>
        ))}
      </div>
      {ayuda && (
        <span className="field__hint" style={{ display: 'block', marginTop: 'var(--sp-2)' }}>
          {ayuda}
        </span>
      )}
    </fieldset>
  )
}

/** Elección entre dos opciones excluyentes, del tamaño de un botón. */
export function Alternativa<T extends string>({
  etiqueta,
  opciones,
  valor,
  alElegir,
}: {
  etiqueta: string
  opciones: { valor: T; texto: string }[]
  valor: T
  alElegir: (v: T) => void
}) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="field__label" style={{ padding: 0, marginBottom: 'var(--sp-2)' }}>
        {etiqueta}
      </legend>
      <div className="segmented" style={{ ['--seg-count' as string]: String(opciones.length) }}>
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="tab"
            aria-selected={valor === o.valor}
            className="segmented__option"
            onClick={() => alElegir(o.valor)}
          >
            <span>{o.texto}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** Lista de lo que falta para poder enviar. Evita el botón muerto sin motivo. */
export function QueFalta({ faltan }: { faltan: string[] }) {
  if (faltan.length === 0) return null
  return (
    <p style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)', margin: 0 }}>
      Para enviarlo falta: {faltan.join(', ')}.
    </p>
  )
}
