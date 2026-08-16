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
  /* La ficha de un centro faltaba en esta lista, y ahí es donde apareció el
     desborde: nombres largos, direcciones largas y una cabecera con sello y
     estado que no caben en 375px. Un centro real y concreto, no uno de paja. */
  { nombre: 'centro', url: '/centro/e7f85158-92b6-42bb-a4e4-a14b3b8e50ea' },
  { nombre: 'que-falta', url: '/que-falta' },
  { nombre: 'inventario', url: '/inventario' },
  { nombre: 'ayuda-directa', url: '/ayuda-directa' },
  { nombre: 'manos', url: '/manos' },
  { nombre: 'mapa', url: '/mapa' },
  { nombre: 'afectaciones', url: '/afectaciones' },
  { nombre: 'como-ayudar', url: '/como-ayudar' },
  { nombre: 'acerca', url: '/acerca' },
  { nombre: 'ruta-inexistente', url: '/no-existe-esta-ruta' },
]

/** Espera a que la app pinte contenido real, no el esqueleto de carga. */
async function esperarContenido(page: Page) {
  // La portada usa el hero; el resto de pantallas, la cabecera de página.
  await page.waitForSelector('.page-header__title, .hero__titulo', { timeout: 15_000 })
  // Timeout propio: una pantalla que consulta una API externa puede no llegar
  // nunca a "networkidle", y sin límite la espera se comería el test entero.
  // El layout ya está pintado, que es lo que se va a medir.
  await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => {})
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
      // La rejilla de un mapa de tiles se dibuja a propósito más ancha que su
      // caja: las teselas de los bordes sobresalen y el contenedor las recorta.
      // Medir eso es medir cómo funciona un mapa, no un fallo de maquetación;
      // el scroll real de la página lo sigue comprobando la segunda parte.
      if (el.classList.contains('leaflet-tile')) continue

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
    await pAuto.waitForSelector('.page-header__title, .hero__titulo')
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
    await pElegido.waitForSelector('.page-header__title, .hero__titulo')
    await expect(pElegido.locator('html')).toHaveAttribute('data-theme', 'dark')
    const elegido = await leerTokens(pElegido)
    await ctxElegido.close()

    expect(elegido).toEqual(automatico)
  })

  /**
   * El amarillo de marca (#ffff00) contrasta 1.07:1 con el blanco: es un color
   * de FONDO, no de tinta. Por eso aquí no se comprueba brand-vs-canvas —
   * fallaría por diseño— sino los dos pares que sí tienen que ser legibles:
   * la tinta de acción sobre el fondo, y la tinta sobre el amarillo.
   */
  test('los pares de color legibles contrastan en ambos temas', async ({ page }) => {
    const luminancia = (hex: string) => {
      const m = hex.replace('#', '').trim()
      const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
      const canal = (v: number) =>
        v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      const [r, g, b] = [0, 2, 4].map((i) => canal(parseInt(n.slice(i, i + 2), 16) / 255))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ratio = (a: string, b: string) => {
      const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p)
      return (x + 0.05) / (y + 0.05)
    }

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
      await page.waitForSelector('.page-header__title, .hero__titulo')

      const c = await page.evaluate(() => {
        const e = getComputedStyle(document.documentElement)
        const v = (n: string) => e.getPropertyValue(n).trim()
        return {
          accion: v('--accion'),
          canvas: v('--canvas'),
          brand: v('--brand'),
          onBrand: v('--on-brand'),
          texto: v('--text'),
          superficie: v('--surface'),
        }
      })

      // Texto de cuerpo sobre su superficie: exigencia AA para texto normal.
      expect(
        ratio(c.texto, c.superficie),
        `tema ${tema}: --text ${c.texto} sobre --surface ${c.superficie}`,
      ).toBeGreaterThan(4.5)

      // Tinta de acción sobre el fondo de la página.
      expect(
        ratio(c.accion, c.canvas),
        `tema ${tema}: --accion ${c.accion} sobre --canvas ${c.canvas}`,
      ).toBeGreaterThan(4.5)

      // Lo que se escribe ENCIMA del amarillo de marca (botones primarios).
      expect(
        ratio(c.onBrand, c.brand),
        `tema ${tema}: --on-brand ${c.onBrand} sobre --brand ${c.brand}`,
      ).toBeGreaterThan(4.5)
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
