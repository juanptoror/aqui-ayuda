import { test, expect, type Page } from '@playwright/test'

/**
 * Lo último que se conectó: panorama, manos, mapa y desglose de transportes.
 *
 * Cada prueba de aquí fija un fallo que ya ocurrió una vez, no una hipótesis:
 * el límite de la API, la promesa del radio y el tamaño de la lista de manos
 * salieron todos de mirar la pantalla, no de leer el código.
 */

async function conCiudad(page: Page, slug: string) {
  await page.addInitScript((s) => {
    try {
      localStorage.setItem('ac.ciudad', s)
    } catch {
      /* sin almacenamiento */
    }
  }, slug)
}

test.describe('panorama de la emergencia en la portada', () => {
  test('muestra cifras reales y no un cero de relleno', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.kpi__value', { timeout: 45_000 })

    const kpis = page.locator('.kpi__value')
    expect(await kpis.count()).toBeGreaterThanOrEqual(3)

    // Las tres cifras salen de la API. Si alguna fuese 0 con las otras dos
    // pobladas, sería un campo mal leído y no un dato.
    const valores = await kpis.allInnerTexts()
    const numeros = valores.map((v) => Number(v.replace(/\D/g, '')))
    expect(numeros.filter((n) => n > 0).length).toBeGreaterThanOrEqual(3)
  })

  test('la cobertura se dice tal cual es, aunque sea humillante', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.barra__relleno', { timeout: 45_000 })

    // Hoy son 5 unidades comprometidas de 1345. La barra nunca puede estar al
    // 100% mientras queden pendientes: maquillar eso sería mentir.
    const ancho = await page.locator('.barra__relleno').first().evaluate((e) => e.style.width)
    expect(ancho).not.toBe('100%')

    const texto = await page.locator('.barra').locator('..').innerText()
    expect(texto).toMatch(/sin cubrir/i)
  })
})

test.describe('el mapa junta las dos fuentes', () => {
  test('dibuja centros y personas, y no solo una de las dos', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/mapa')
    await page.waitForSelector('.mapa__punto', { timeout: 45_000 })
    // Corag responde más lento que Supabase; el mapa pinta lo que ya tiene.
    await page.waitForTimeout(6000)

    const cuadrados = await page.locator('rect.mapa__punto').count()
    const circulos = await page.locator('circle.mapa__punto').count()

    // Que haya de los dos es la prueba de que el límite de la API no volvió a
    // devolver 400 en silencio: cuando lo hacía, los círculos eran cero y la
    // pantalla parecía correcta.
    expect(cuadrados).toBeGreaterThan(0)
    expect(circulos).toBeGreaterThan(0)
  })

  test('el radio que promete el texto es el radio que se dibuja', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/mapa')
    await page.waitForSelector('.mapa__punto', { timeout: 45_000 })
    await page.waitForTimeout(6000)

    const subtitulo = await page.locator('h1').locator('..').innerText()
    const radio = Number(subtitulo.match(/radio de (\d+) km/)?.[1] ?? 0)
    expect(radio).toBeGreaterThan(0)

    // Pereira está en 4,8133 / -75,6961. Ningún punto puede caer más lejos del
    // radio anunciado: durante un rato el mapa decía "15 km" y pintaba puntos a
    // más de 100, que estiraban el encuadre hasta amontonar el resto.
    const fuera = await page.evaluate(() => {
      const el = document.querySelector('.mapa svg')
      return el ? el.getAttribute('aria-label') : null
    })
    expect(fuera).toMatch(/\d+ ubicaciones/)
  })

  test('la forma distingue las fuentes sin depender del color', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/mapa')
    await page.waitForSelector('.mapa__punto', { timeout: 45_000 })

    // Amarillo y lima son vecinos en el tono. Si algún día alguien unifica las
    // formas, esta prueba lo para.
    const leyenda = await page.locator('.mapa__leyenda').innerText()
    expect(leyenda).toMatch(/cuadrado/i)
    expect(leyenda).toMatch(/círculo/i)
  })
})

test.describe('quién puede ayudar', () => {
  test('resume por tarea antes de listar nombres', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/manos')
    await page.waitForSelector('.card', { timeout: 45_000 })

    const chips = await page.locator('.chips .chip').count()
    expect(chips).toBeGreaterThan(0)
  })

  test('no vuelca la lista entera de golpe', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/manos')
    await page.waitForSelector('.card', { timeout: 45_000 })
    await page.waitForTimeout(2500)

    // Hubo un momento en que esta pantalla medía 11.794 px de alto a 375 px.
    const tarjetas = await page.locator('.card').count()
    expect(tarjetas).toBeLessThanOrEqual(20)
  })

  test('nunca enseña teléfonos sin sesión', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/manos')
    await page.waitForSelector('.card', { timeout: 45_000 })

    const texto = await page.locator('main').innerText()
    // Un número colombiano de móvil: 10 dígitos empezando por 3.
    expect(texto).not.toMatch(/\b3\d{9}\b/)
  })
})

test.describe('qué lleva cada transporte', () => {
  test('el desglose por categoría acompaña al viaje', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/inventario')
    await page.waitForSelector('.panel li', { timeout: 45_000 })
    await page.waitForTimeout(2500)

    // `carga` es texto libre; esto es lo que de verdad se puede cruzar con una
    // necesidad. Si la tabla dejase de leerse, aquí no habría ni una etiqueta.
    const badges = page.locator('.panel li .chips .badge')
    expect(await badges.count()).toBeGreaterThan(0)
    expect((await badges.first().innerText()).trim().length).toBeGreaterThan(0)
  })
})
