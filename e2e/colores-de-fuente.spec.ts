import { test, expect } from '@playwright/test'
import { FUENTES } from '../src/components/Fuente'

/**
 * Que cada dato lleve su sello ya está protegido: los otros e2e comprueban el
 * atributo `data-origen`. Pero eso solo mira el HTML, y el HTML puede estar
 * impecable mientras el usuario no distingue nada: si dos fuentes se pintan
 * igual, el sello está puesto y aun así no dice de quién es el dato.
 *
 * Pasó de verdad. 'vivienda' no tenía regla propia en
 * `.sello-fuente[data-origen=...]`, así que caía en el `var(--brand)` por
 * defecto: exactamente el mismo amarillo que 'ayudas-pereira'. Dos fuentes
 * distintas con el mismo sello, y ningún test se enteró.
 *
 * Este test inyecta un elemento por origen, le pregunta al navegador con qué
 * estilo lo ha resuelto de verdad —variables CSS ya sustituidas— y exige que
 * las firmas salgan todas distintas.
 */

/* La lista NO se escribe a mano: sale de FUENTES. Ese es medio test. Una sexta
   fuente a la que se le olvide el color rompe esto el día que se añade, no el
   día que alguien la vea confundida con otra en pantalla. */
const ORIGENES = Object.keys(FUENTES)

/** Los tres sitios donde se pinta la procedencia. */
const PIEZAS = ['sello-fuente', 'card__accent', 'kpi__icon'] as const

/* Se comprueban los dos temas porque el tratamiento hueco de 'vivienda' se
   apoya en `--text`, que vale negro en claro y casi blanco en oscuro. Un
   choque puede existir en un tema y no en el otro. */
const TEMAS = [
  { valor: 'light', nombre: 'claro' },
  { valor: 'dark', nombre: 'oscuro' },
] as const

/* Lo que el ojo separa de un vistazo: el relleno (plano o de trama), la tinta,
   el trazo del borde y el trazo fingido con sombra —así se dibuja el hueco de
   'vivienda' en el icono, para no mover la rejilla de /acerca con un borde
   real. Dos orígenes que coincidan en las cinco cosas se ven igual. */
const PROPIEDADES = [
  'backgroundColor',
  'backgroundImage',
  'color',
  'borderTopColor',
  'boxShadow',
] as const

/**
 * Pinta cada origen en cada pieza y devuelve su firma visual.
 *
 * Se hace inyectando elementos y no navegando por la app a cazar tarjetas
 * reales: los cinco orígenes no conviven en ninguna pantalla, y el que falte
 * de la muestra es justo el que puede estar chocando con otro.
 */
async function firmarOrigenes(
  page: import('@playwright/test').Page,
  tema: string,
): Promise<Record<string, Record<string, string>>> {
  return page.evaluate(
    ({ origenes, piezas, propiedades, tema }) => {
      document.documentElement.setAttribute('data-theme', tema)

      const jaula = document.createElement('div')
      // Fuera de la vista pero dentro del flujo: `display:none` no obliga al
      // navegador a resolver los valores usados y falsearía la lectura.
      jaula.style.cssText = 'position:absolute;left:-9999px;top:0'
      document.body.appendChild(jaula)

      const firmas: Record<string, Record<string, string>> = {}
      try {
        for (const pieza of piezas) {
          firmas[pieza] = {}
          for (const origen of origenes) {
            const el = document.createElement('span')
            el.className = pieza
            el.setAttribute('data-origen', origen)
            jaula.appendChild(el)

            const estilo = getComputedStyle(el)
            firmas[pieza][origen] = propiedades
              .map((p) => `${p}: ${estilo[p as keyof CSSStyleDeclaration] as string}`)
              .join(' · ')
          }
        }
      } finally {
        jaula.remove()
      }
      return firmas
    },
    { origenes: ORIGENES, piezas: [...PIEZAS], propiedades: [...PROPIEDADES], tema },
  )
}

test.describe('cada fuente se ve distinta de las demás', () => {
  test('FUENTES declara más de un origen que distinguir', () => {
    // Si el import se rompiera y llegara un objeto vacío, el resto de tests
    // pasaría sin comprobar nada. Esto lo impide.
    expect(ORIGENES.length).toBeGreaterThan(1)
  })

  for (const tema of TEMAS) {
    test(`ningún par de orígenes comparte tratamiento en tema ${tema.nombre}`, async ({
      page,
    }) => {
      await page.goto('/')
      await page.waitForSelector('.hero__titulo')

      const firmas = await firmarOrigenes(page, tema.valor)

      const choques: string[] = []
      for (const pieza of PIEZAS) {
        const porFirma = new Map<string, string[]>()
        for (const origen of ORIGENES) {
          const firma = firmas[pieza][origen]
          porFirma.set(firma, [...(porFirma.get(firma) ?? []), origen])
        }
        for (const [firma, iguales] of porFirma) {
          if (iguales.length > 1) {
            choques.push(
              `.${pieza} · tema ${tema.nombre}: ${iguales
                .map((o) => `'${o}'`)
                .join(' y ')} se pintan igual → ${firma}`,
            )
          }
        }
      }

      expect(
        choques,
        `hay fuentes indistinguibles; a cada una le falta su regla en ` +
          `src/styles/ui.css (sección "Sello de procedencia"):\n${choques.join('\n')}`,
      ).toEqual([])
    })
  }
})
