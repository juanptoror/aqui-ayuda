import { Link } from 'react-router-dom'
import { Ban, CircleCheck, Eye, HardDrive, Info, ScrollText } from 'lucide-react'
import { PageHeader, SectionHead, Notice } from '@/components/ui'
import { TarjetaFuente } from '@/components/Fuente'

/**
 * Acerca del proyecto: qué es esto y qué pasa con tus datos.
 *
 * Está escrito para que lo entienda cualquiera, no para cubrirnos las espaldas.
 * La idea que ordena la página es sencilla y cierta: AquíAyuda no guarda nada.
 * Es una ventana a dos servicios que sí guardan, y cada uno tiene sus propias
 * condiciones, enlazadas y resumidas aquí para que no haya que ir a buscarlas.
 *
 * El detalle técnico (estado de las tablas, permisos, errores) vive en /estado,
 * que es donde lo busca quien lo necesita.
 */
export function Acerca() {
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Info size={13} strokeWidth={2.6} />
            Acerca del proyecto
          </>
        }
        titulo="Qué es AquíAyuda y qué pasa con tus datos"
        subtitulo="Una iniciativa para centralizar la información de las ayudas tras el terremoto y que llegue donde hace falta. Sin registrarte, sin publicidad y sin cobrar nada."
        estrecho
      />

      <div className="container container--narrow">
        {/* --------------------- LO MÁS IMPORTANTE, PRIMERO --------------------- */}
        <div className="stack">
          <Notice tono="info" icono={HardDrive}>
            <strong>Nosotros no guardamos nada tuyo.</strong> AquíAyuda no tiene base de datos ni
            servidor propio: es una ventana a dos servicios que sí guardan información, y abajo te
            contamos qué hace cada uno.
          </Notice>
        </div>

        <section className="section">
          <SectionHead titulo="Qué queda en tu teléfono" />
          <div className="panel">
            <div className="panel__body stack">
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                Tres cosas, y las tres se quedan dentro de tu navegador. Si borras los datos del
                navegador, desaparecen.
              </p>
              <ul className="lista-clara lista-clara--simple">
                <li>
                  <strong>El municipio que elegiste</strong>, para no volver a preguntártelo cada
                  vez que entras.
                </li>
                <li>
                  <strong>Si prefieres el tema claro u oscuro.</strong>
                </li>
                <li>
                  <strong>Tu ubicación</strong>, solo si nos la das, y únicamente para calcular a
                  qué distancia te queda cada centro. Ese cálculo ocurre en tu teléfono.
                </li>
              </ul>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                No usamos cookies de seguimiento ni analítica propia. No sabemos quién eres ni
                cuántas veces entras.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <SectionHead titulo="Cuándo sí salen datos de tu teléfono" />
          <div className="panel">
            <div className="panel__body">
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                Solo cuando tú decides hacer algo, y siempre te lo decimos antes:
              </p>
              <ul
                className="lista-clara lista-clara--simple"
                style={{ marginTop: 'var(--sp-4)' }}
              >
                <li>
                  <strong>Si entras con tu correo</strong> para ver los teléfonos de los centros,
                  ese correo va a Ayudas Pereira, que es quien te manda el código.
                </li>
                <li>
                  <strong>Si publicas una solicitud o un ofrecimiento</strong>, lo que escribas
                  —incluidos tu nombre, tu WhatsApp y tu ubicación— se envía a Corag y queda
                  público. Por eso hay que marcar una casilla a mano: nadie la marca por ti.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ------------------------------ LAS FUENTES ---------------------------- */}
        <section className="section">
          <SectionHead titulo="Quién guarda la información que ves" />
          <p className="section__desc">
            Dos organizaciones distintas, cada una con sus reglas. Cada dato de la app lleva el
            sello de la suya para que sepas siempre a quién corresponde.
          </p>
          <div className="grid grid--halves">
            <TarjetaFuente
              origen="ayudas-pereira"
              extra="Municipios, centros de acopio, qué necesitan y su inventario."
            />
            <TarjetaFuente
              origen="corag"
              extra="La pantalla de ayuda entre personas y el formulario para publicar."
            />
          </div>
        </section>

        {/* -------------------------- AYUDAS PEREIRA ----------------------------- */}
        <section className="section">
          <SectionHead titulo="Condiciones de Ayudas Pereira" />
          <div className="panel">
            <div className="panel__body stack">
              <Bloque titulo="Qué guardan">
                Lo que se registra en la app: centros, direcciones, inventarios, necesidades,
                transportes, donaciones y vehículos. Y los datos de contacto que alguien escribe
                —nombre, teléfono y correo— para poder coordinar.
              </Bloque>

              <Bloque titulo="Para qué">
                Solo para coordinar la ayuda de la emergencia: saber qué falta, dónde sobra y quién
                puede llevarlo. <strong>No venden ni ceden estos datos a nadie.</strong>
              </Bloque>

              <Bloque titulo="Quién los ve" icono={Eye}>
                Los inventarios y las necesidades son públicos: esa es la razón de ser de la app.
                Los teléfonos solo los ve quien entró con su correo, y cada cambio queda registrado
                con el correo de quien lo hizo.
              </Bloque>

              <Bloque titulo="Cookies">
                Usan Google Analytics para contar cuántas personas entran y qué secciones usan. No
                graba tu pantalla ni lo que escribes en los formularios, y los códigos de invitación
                nunca se le envían.
              </Bloque>

              <Bloque titulo="Tus derechos" icono={ScrollText}>
                Puedes pedir que corrijan o eliminen tus datos escribiendo a{' '}
                <a href="mailto:felipelebrun@gmail.com">felipelebrun@gmail.com</a>. Ley 1581 de 2012
                de protección de datos personales.
              </Bloque>
            </div>
          </div>
        </section>

        {/* ------------------------------- CORAG --------------------------------- */}
        <section className="section">
          <SectionHead titulo="Condiciones de Corag" />
          <div className="panel">
            <div className="panel__body stack">
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                Corag coordina ayuda entre personas que casi siempre están pasando un mal momento,
                y trata eso como parte del servicio y no como una nota al pie. Este es el resumen;
                el texto completo está en su web.
              </p>

              <Bloque titulo="Qué recogen">
                Lo que escribes en sus formularios de contacto o en un reporte de conducta —que
                puede enviarse de forma anónima, y entonces no guardan ni nombre ni correo—.
                Métricas de uso agregadas y sin cookies, que no identifican a nadie. Tu idioma y tu
                tema se quedan en tu navegador.
              </Bloque>

              <Bloque titulo="Qué no hacen nunca" icono={Ban}>
                <ul className="lista-clara lista-clara--simple">
                  <li>Vender, alquilar o ceder datos personales a terceros.</li>
                  <li>
                    Publicar teléfonos, direcciones o ubicaciones exactas sin autorización explícita
                    de la persona.
                  </li>
                  <li>Usar los datos de un formulario para mandarte publicidad que no pediste.</li>
                  <li>Publicar evidencia con rasgos identificables de menores de edad.</li>
                </ul>
              </Bloque>

              <Bloque titulo="Cuánto tiempo se guarda">
                Los mensajes, mientras la conversación siga abierta y un tiempo razonable después.
                La evidencia de una entrega permanece, porque es lo que hace verificable la ayuda;
                los datos personales de quien recibió no forman parte de esa publicación.
              </Bloque>

              <Bloque titulo="Tus derechos" icono={ScrollText}>
                Puedes pedir acceso a tus datos, su corrección o su eliminación, y retirar una
                autorización que hayas dado antes. Si algo publicado te afecta y crees que no
                debería estar ahí, dilo: se revisa siempre, y mientras se revisa se puede
                despublicar.
              </Bloque>

              <Bloque titulo="Servicios que usan">
                Su sitio se aloja en Cloudflare Pages, los formularios pasan por Dailybot y las
                respuestas automáticas se envían con Resend. Cada uno recibe únicamente lo que
                necesita para cumplir su función.
              </Bloque>
            </div>
            <div className="card__footer">
              <a
                className="btn btn--sm"
                href="https://corag.app/privacy/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Leer la política completa de Corag</span>
              </a>
            </div>
          </div>
        </section>

        {/* ------------------------------- RESUMEN ------------------------------- */}
        <section className="section">
          <SectionHead titulo="En una frase" />
          <div className="panel">
            <div className="panel__body">
              <ul className="lista-clara">
                <li>
                  <CircleCheck size={16} style={{ color: 'var(--success)' }} />
                  <span>
                    Puedes usar toda la app <strong>sin dar ningún dato</strong>: buscar tu
                    municipio, ver qué falta y cómo llegar.
                  </span>
                </li>
                <li>
                  <CircleCheck size={16} style={{ color: 'var(--success)' }} />
                  <span>
                    Solo se envía algo <strong>cuando tú lo decides</strong>: al entrar con tu
                    correo o al publicar una ayuda.
                  </span>
                </li>
                <li>
                  <CircleCheck size={16} style={{ color: 'var(--success)' }} />
                  <span>
                    Si quieres que borren algo, escribe a{' '}
                    <a href="mailto:felipelebrun@gmail.com">felipelebrun@gmail.com</a> (Ayudas
                    Pereira) o usa el formulario de{' '}
                    <a href="https://corag.app/privacy/" target="_blank" rel="noopener noreferrer">
                      Corag
                    </a>
                    .
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="section">
          <p style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>
            ¿Buscabas el detalle técnico? El estado de las fuentes de datos, los permisos y los
            errores en vivo están en <Link to="/estado">estado del sistema</Link>.
          </p>
        </section>
      </div>
    </>
  )
}

function Bloque({
  titulo,
  icono: Icono,
  children,
}: {
  titulo: string
  icono?: typeof Eye
  children: React.ReactNode
}) {
  return (
    <div>
      <h3
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          fontSize: 'var(--text-h3)',
          marginBottom: 'var(--sp-2)',
        }}
      >
        {Icono && <Icono size={17} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />}
        {titulo}
      </h3>
      <div style={{ color: 'var(--text-muted)' }}>{children}</div>
    </div>
  )
}
