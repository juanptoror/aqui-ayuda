import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Ban,
  Building2,
  CircleCheck,
  HeartHandshake,
  Package,
  Phone,
  TriangleAlert,
} from 'lucide-react'
import { PageHeader, SectionHead } from '@/components/ui'
import { SelectorCiudad } from '@/components/SelectorCiudad'
import { usePreferencias } from '@/state/preferencias'

const PASOS = [
  {
    icono: Building2,
    titulo: 'Elige el municipio',
    texto:
      'Lo que sobra en un municipio falta en el de al lado. Empieza por saber a dónde va tu ayuda.',
  },
  {
    icono: Package,
    titulo: 'Mira qué están pidiendo',
    texto:
      'Cada centro publica lo que necesita y lo que ya tiene. Lleva solo lo que aparece como pedido abierto.',
  },
  {
    icono: Phone,
    titulo: 'Llama antes de salir',
    texto:
      'Confirma el horario y que sigan recibiendo. Un centro puede llenarse en pocas horas.',
  },
  {
    icono: HeartHandshake,
    titulo: 'Entrega y avisa',
    texto:
      'Pide que actualicen el pedido como cubierto. Así el siguiente donante no repite lo mismo.',
  },
]

const SI = [
  'Agua embotellada y alimentos no perecederos sellados',
  'Elementos de aseo e higiene personal sin abrir',
  'Pañales, leche de fórmula y elementos para bebés',
  'Cobijas y colchonetas limpias y en buen estado',
  'Linternas, pilas y cargadores',
]

const NO = [
  'Ropa usada en mal estado o sin lavar',
  'Alimentos preparados en casa sin cadena de frío',
  'Medicamentos vencidos o sin fórmula médica',
  'Cosas que nadie pidió: ocupan espacio y personal que hace falta en otra parte',
]

export function ComoAyudar() {
  const { ciudadGuardada } = usePreferencias()
  const [selectorAbierto, setSelectorAbierto] = useState(false)

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <HeartHandshake size={13} strokeWidth={2.6} />
            Guía rápida
          </>
        }
        titulo="Cómo ayudar sin estorbar"
        subtitulo="Cuatro pasos para que lo que entregues sirva de verdad. En una emergencia, la ayuda mal dirigida consume el tiempo de quienes están respondiendo."
        acciones={
          ciudadGuardada ? (
            <Link className="btn btn--primary btn--lg" to={`/ciudad/${ciudadGuardada}`}>
              <Package size={19} />
              <span>Ver qué falta cerca</span>
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => setSelectorAbierto(true)}
            >
              <Building2 size={19} />
              <span>Elegir municipio</span>
            </button>
          )
        }
      />

      <div className="container">
        <section className="section" style={{ marginTop: 0 }}>
          <SectionHead titulo="Los cuatro pasos" />
          <div className="grid grid--cards">
            {PASOS.map((p, i) => (
              <article key={p.titulo} className="card">
                <div className="card__body">
                  <div className="row">
                    <span className="kpi__icon">
                      <p.icono size={16} strokeWidth={2.25} />
                    </span>
                    <span className="deflist__label">Paso {i + 1}</span>
                  </div>
                  <h3 className="card__title">{p.titulo}</h3>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>{p.texto}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section">
          <SectionHead titulo="Qué llevar y qué no" />
          <div className="grid grid--halves">
            <div className="panel">
              <div className="panel__header">
                <CircleCheck size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <h3 className="panel__title">Sirve</h3>
              </div>
              <div className="panel__body">
                <ul style={{ margin: 0, paddingInlineStart: '1.15rem', display: 'grid', gap: 'var(--sp-3)' }}>
                  {SI.map((t) => (
                    <li key={t} style={{ color: 'var(--text-muted)' }}>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="panel">
              <div className="panel__header">
                <Ban size={18} style={{ color: 'var(--critical)', flexShrink: 0 }} />
                <h3 className="panel__title">No sirve</h3>
              </div>
              <div className="panel__body">
                <ul style={{ margin: 0, paddingInlineStart: '1.15rem', display: 'grid', gap: 'var(--sp-3)' }}>
                  {NO.map((t) => (
                    <li key={t} style={{ color: 'var(--text-muted)' }}>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="notice notice--warning">
            <TriangleAlert size={17} strokeWidth={2.25} />
            <div className="notice__text">
              <strong>En emergencia activa, llama al 123.</strong> Esta página es un directorio de
              centros de acopio: no reemplaza a los organismos de socorro ni gestiona rescates.
            </div>
          </div>
        </section>
      </div>

      <SelectorCiudad abierto={selectorAbierto} alCerrar={() => setSelectorAbierto(false)} />
    </>
  )
}
