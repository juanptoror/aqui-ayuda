import { test, expect, type Page } from '@playwright/test'

/**
 * Red de seguridad contra el desbordamiento horizontal.
 *
 * Un scroll lateral en una web app es el síntoma más claro de "app de celular
 * estirada": algo se salió de su contenedor. Estos tests fallan si aparece, en
 * cualquiera de los tres anchos de referencia y en cualquier ruta.
 *
 * Importante: la app NO usa `overflow-x: hidden` en html/body, precisamente
 * para que estos tests puedan ver el desborde en lugar de que quede escondido.
 */

const ANCHOS = [
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'tablet', width: 834, height: 1112 },
  { nombre: 'movil', width: 375, height: 812 },
]

const RUTAS = [
  { nombre: 'inicio', url: '/' },
  { nombre: 'municipios', url: '/ciudades' },
  { nombre: 'ciudad', url: '/ciudad/dosquebradas' },
  { nombre: 'que-falta', url: '/que-falta' },
  { nombre: 'como-ayudar', url: '/como-ayudar' },
  { nombre: 'acerca', url: '/acerca' },
  { nombre: 'ruta-inexistente', url: '/no-existe-esta-ruta' },
]

/** Espera a que la app pinte contenido real, no el esqueleto de carga. */
async function esperarContenido(page: Page) {
  await page.waitForSelector('.page-header__title', { timeout: 15_000 })
  await page.waitForLoadState('networkidle').catch(() => {
    /* con red lenta seguimos: el layout ya está pintado */
  })
}

/** Elementos que sobresalen del ancho de la ventana. */
async function elementosDesbordados(page: Page) {
  return page.evaluate(() => {
    const limite = document.documentElement.clientWidth
    const culpables: { etiqueta: string; clase: string; derecha: number; texto: string }[] = []

    /** Un contenedor con scroll horizontal propio absuelve a sus descendientes. */
    const dentroDeScroller = (el: HTMLElement): boolean => {
      let p: HTMLElement | null = el.parentElement
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX
        if (ox === 'auto' || ox === 'scroll') return true
        p = p.parentElement
      }
      return false
    }

    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const estilo = getComputedStyle(el)
      if (estilo.display === 'none' || estilo.visibility === 'hidden') continue
      // Los contenedores con scroll horizontal propio (tablas anchas, bloques
      // de código) están autorizados a tener contenido más ancho que ellos.
      if (estilo.overflowX === 'auto' || estilo.overflowX === 'scroll') continue
      if (dentroDeScroller(el)) continue

      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue

      // 1px de tolerancia por redondeo subpíxel del motor de layout.
      if (r.right > limite + 1) {
        culpables.push({
          etiqueta: el.tagName.toLowerCase(),
          clase: el.className?.toString().slice(0, 80) ?? '',
          derecha: Math.round(r.right),
          texto: (el.textContent ?? '').trim().slice(0, 60),
        })
      }
    }
    return { limite, culpables: culpables.slice(0, 12) }
  })
}

for (const ancho of ANCHOS) {
  test.describe(`${ancho.nombre} (${ancho.width}px)`, () => {
    test.use({ viewport: { width: ancho.width, height: ancho.height } })

    for (const ruta of RUTAS) {
      test(`${ruta.nombre} no desborda horizontalmente`, async ({ page }) => {
        await page.goto(ruta.url)
        await esperarContenido(page)

        // Se identifican los culpables primero para que, si algo falla, el
        // mensaje diga QUÉ elemento desbordó y no solo que hay scroll.
        const { limite, culpables } = await elementosDesbordados(page)

        // 1. Ningún elemento visible puede sobresalir del borde derecho.
        expect(
          culpables,
          `Elementos que se salen de ${limite}px:\n${JSON.stringify(culpables, null, 2)}`,
        ).toEqual([])

        // 2. El documento no puede tener scroll horizontal.
        const doc = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }))
        expect(
          doc.scrollWidth,
          `La página tiene scroll horizontal: ${doc.scrollWidth}px de contenido en ${doc.clientWidth}px de ventana.`,
        ).toBeLessThanOrEqual(doc.clientWidth + 1)
      })
    }
  })
}

test.describe('textos largos', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('un nombre de municipio muy largo no rompe el layout en móvil', async ({ page }) => {
    // "Altagracia, vereda alegrias y yarumal" es el nombre más largo del
    // catálogo real: es el caso que de verdad rompe las tarjetas estrechas.
    await page.goto('/ciudades')
    await esperarContenido(page)
    await page.getByLabel('Buscar municipio').fill('altagracia')
    await page.waitForTimeout(300)

    const { culpables } = await elementosDesbordados(page)
    expect(culpables, JSON.stringify(culpables, null, 2)).toEqual([])
  })
})

test.describe('flujos reales', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('elegir un municipio lleva a su panel y guarda la elección', async ({ page }) => {
    await page.goto('/')
    await esperarContenido(page)

    await page.getByRole('button', { name: 'Elegir municipio' }).click()
    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toBeVisible()

    await dialogo.getByLabel('Buscar municipio').fill('dosquebradas')
    await dialogo.getByRole('button', { name: /Dosquebradas/ }).click()

    await expect(page).toHaveURL(/\/ciudad\/dosquebradas/)
    await expect(page.locator('.page-header__title')).toHaveText('Dosquebradas')

    // Al volver al inicio la app recuerda el municipio, sin volver a preguntar.
    await page.goto('/')
    await esperarContenido(page)
    await expect(page.getByText('Seguiste consultando')).toBeVisible()
  })

  test('el enlace antiguo /?ciudad=slug sigue funcionando', async ({ page }) => {
    await page.goto('/?ciudad=dosquebradas')
    await expect(page).toHaveURL(/\/ciudad\/dosquebradas/)
    await expect(page.locator('.page-header__title')).toHaveText('Dosquebradas')
  })

  test('una ciudad fusionada redirige a la vigente en vez de quedar vacía', async ({ page }) => {
    // "pereira" está marcada como fusionada en "pereira-2" en la base real.
    await page.goto('/ciudad/pereira')
    await expect(page).toHaveURL(/\/ciudad\/pereira-2/)
    await expect(page.locator('.page-header__title')).toHaveText('Pereira')
  })

  test('los dos modos muestran contenido distinto', async ({ page }) => {
    await page.goto('/ciudad/dosquebradas')
    await esperarContenido(page)

    const ayudar = page.getByRole('tab', { name: 'Quiero ayudar' })
    const recibir = page.getByRole('tab', { name: 'Necesito ayuda' })

    await expect(ayudar).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: 'Centros que están recibiendo' })).toBeVisible()

    await recibir.click()
    await expect(recibir).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: 'Centros abiertos cerca de ti' })).toBeVisible()
  })

  test('el tema oscuro se aplica y persiste', async ({ page }) => {
    await page.goto('/')
    await esperarContenido(page)

    const html = page.locator('html')
    const temaInicial = await html.getAttribute('data-theme')

    await page.getByRole('button', { name: /^Usar tema/ }).first().click()
    const temaNuevo = await html.getAttribute('data-theme')
    expect(temaNuevo).not.toBe(temaInicial)

    await page.reload()
    await esperarContenido(page)
    await expect(html).toHaveAttribute('data-theme', temaNuevo!)
  })
})

test.describe('coherencia del tema', () => {
  /**
   * El tema oscuro está declarado dos veces: en `@media (prefers-color-scheme:
   * dark)` para quien nunca eligió, y en `:root[data-theme='dark']` para quien
   * pulsó el botón. Es fácil tocar uno y olvidar el otro —ya pasó— y el
   * resultado es que el oscuro automático y el elegido no coinciden.
   */
  const TOKENS = ['--brand', '--critical', '--surface', '--canvas', '--text']

  async function leerTokens(page: import('@playwright/test').Page) {
    return page.evaluate((nombres) => {
      const estilo = getComputedStyle(document.documentElement)
      return Object.fromEntries(nombres.map((n) => [n, estilo.getPropertyValue(n).trim()]))
    }, TOKENS)
  }

  test('el oscuro automático y el elegido dan los mismos colores', async ({ browser }) => {
    // Automático: el sistema pide oscuro y el usuario nunca eligió tema.
    const ctxAuto = await browser.newContext({ colorScheme: 'dark' })
    const pAuto = await ctxAuto.newPage()
    await pAuto.addInitScript(() => {
      try {
        localStorage.removeItem('ac.theme')
      } catch {
        /* sin almacenamiento */
      }
    })
    await pAuto.goto('/')
    await pAuto.waitForSelector('.page-header__title')
    const automatico = await leerTokens(pAuto)
    await ctxAuto.close()

    // Elegido: el sistema pide claro pero el usuario seleccionó oscuro.
    const ctxElegido = await browser.newContext({ colorScheme: 'light' })
    const pElegido = await ctxElegido.newPage()
    await pElegido.addInitScript(() => {
      try {
        localStorage.setItem('ac.theme', 'dark')
      } catch {
        /* sin almacenamiento */
      }
    })
    await pElegido.goto('/')
    await pElegido.waitForSelector('.page-header__title')
    await expect(pElegido.locator('html')).toHaveAttribute('data-theme', 'dark')
    const elegido = await leerTokens(pElegido)
    await ctxElegido.close()

    expect(elegido).toEqual(automatico)
  })

  test('el color de acción contrasta con el fondo en ambos temas', async ({ page }) => {
    for (const tema of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: tema })
      await page.addInitScript((t) => {
        try {
          localStorage.setItem('ac.theme', t)
        } catch {
          /* sin almacenamiento */
        }
      }, tema)
      await page.goto('/')
      await page.waitForSelector('.page-header__title')

      const { brand, canvas } = await page.evaluate(() => {
        const e = getComputedStyle(document.documentElement)
        return {
          brand: e.getPropertyValue('--brand').trim(),
          canvas: e.getPropertyValue('--canvas').trim(),
        }
      })

      const luz = (hex: string) => {
        const m = hex.replace('#', '')
        const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }

      // No es un cálculo WCAG completo: solo comprueba que el color de acción
      // y el fondo estén en extremos opuestos, que es donde falla al invertir.
      expect(
        Math.abs(luz(brand) - luz(canvas)),
        `en tema ${tema}, --brand ${brand} no contrasta con --canvas ${canvas}`,
      ).toBeGreaterThan(0.4)
    }
  })
})

test.describe('navegación por dispositivo', () => {
  test('en escritorio hay barra lateral y no navegación inferior', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await esperarContenido(page)

    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('.bottomnav')).toBeHidden()
  })

  test('en móvil hay navegación inferior y no barra lateral', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await esperarContenido(page)

    await expect(page.locator('.bottomnav')).toBeVisible()
    await expect(page.locator('.sidebar')).toBeHidden()
  })
})
