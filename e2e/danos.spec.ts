import { test, expect, type Page } from '@playwright/test'

/**
 * La quinta fuente: los daños de Pereira Responde.
 *
 * Cada prueba de aquí fija una trampa concreta de esa API, no una hipótesis.
 * Las tres primeras salieron de medir la API antes de escribir una línea de
 * interfaz: el límite por defecto recorta casi la mitad de la ciudad, el campo
 * que parece el barrio es un relleno, y las fotos pesan varios megas cada una.
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

/**
 * Espera a que haya tarjetas DE VERDAD.
 *
 * `.card` no basta: los marcadores de carga usan la misma clase a propósito
 * —para que el layout no salte— y una prueba que solo espere a `.card` mide el
 * esqueleto. El sello de procedencia solo lo pinta una tarjeta con datos.
 */
async function esperarTarjetas(page: Page) {
  await page.waitForSelector('.card .sello-fuente', { timeout: 45_000 })
}

const RUTA_API = '**/api/public/v1/reports*'

test.describe('daños y vías cerradas', () => {
  test('pide el máximo de reportes y no se queda con los 100 por defecto', async ({ page }) => {
    /* La API devuelve 100 si no se pide `limit`, y hoy hay 180 reportes: sin
       esto la pantalla enseñaría media ciudad sin avisar de nada. No se
       comprueba contando tarjetas, que dependería de cuántos daños haya hoy,
       sino mirando lo que se pide de verdad. */
    const urls: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/public/v1/reports')) urls.push(r.url())
    })

    await conCiudad(page, 'pereira-2')
    await page.goto('/danos')
    await esperarTarjetas(page)

    expect(urls.length).toBeGreaterThan(0)
    for (const u of urls) expect(u).toContain('limit=500')
  })

  test('no carga ninguna foto hasta que alguien la pide', async ({ page }) => {
    /* Medidas contra la fuente: entre 3 y 7 MB por imagen, sin miniatura. Con
       179 reportes con foto, una rejilla que las cargue sola son cientos de
       megas sobre la red de una ciudad que acaba de temblar. */
    const fotos: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/photos/')) fotos.push(r.url())
    })

    await conCiudad(page, 'pereira-2')
    await page.goto('/danos')
    await esperarTarjetas(page)
    await page.waitForTimeout(2500)

    expect(fotos).toHaveLength(0)

    // Y al pedirla, se carga esa y solo esa.
    await page.getByRole('button', { name: /ver (la foto|\d+ fotos)/i }).first().click()
    await page.waitForSelector('[role="dialog"] img', { timeout: 30_000 })
    expect(fotos.length).toBeGreaterThan(0)
    expect(fotos.length).toBeLessThanOrEqual(2)
  })

  test('el relleno "Ubicación registrada" no llega a la pantalla', async ({ page }) => {
    /* El esquema llama `area` a ese campo y lo ejemplifica como "Barrio Boston",
       pero es la nota opcional del formulario: 163 de 180 traen ese relleno.
       Pintarlo sería inventarle una dirección al reporte. */
    await conCiudad(page, 'pereira-2')
    await page.goto('/danos')
    await esperarTarjetas(page)

    const texto = await page.locator('main').innerText()
    expect(texto).not.toContain('Ubicación registrada')
  })

  test('cada tarjeta lleva el sello de su fuente y ninguna otra', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/danos')
    await esperarTarjetas(page)

    const tarjetas = await page.locator('.card').count()
    const sellos = await page.locator(".card .sello-fuente[data-origen='pereira-responde']").count()
    expect(tarjetas).toBeGreaterThan(0)
    expect(sellos).toBe(tarjetas)

    // Nada de otra procedencia se cuela en esta lista.
    const ajenos = await page
      .locator(".card .sello-fuente:not([data-origen='pereira-responde'])")
      .count()
    expect(ajenos).toBe(0)
  })

  test('el punto del daño es redondo y rojo, y se distingue sin ver el color', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/danos')
    await page.waitForSelector('.mapa__punto--dano', { timeout: 45_000 })

    /* El color no basta: rojo y lima se confunden con daltonismo rojo-verde y
       los dos son círculos. El anillo interior es lo que los separa cuando el
       tono no ayuda, así que se comprueba que sigue ahí. */
    const punto = page.locator('.leaflet-marker-icon.mapa__punto--dano').first()
    if ((await punto.count()) > 0) {
      const estilo = await punto.evaluate((el) => {
        const s = getComputedStyle(el)
        return { radius: s.borderRadius, shadow: s.boxShadow, bg: s.backgroundColor }
      })
      expect(estilo.radius).toContain('50%')
      expect(estilo.shadow).toContain('inset')
    }

    const leyenda = await page.locator('.mapa__leyenda').innerText()
    expect(leyenda).toMatch(/rojo/i)
    // Y no nombra formas que no están en este mapa.
    expect(leyenda).not.toMatch(/cuadrado/i)
  })

  test('aquí no se reporta: la acción sale a la fuente', async ({ page }) => {
    /* La API pública es de solo lectura. Un formulario propio perdería el
       reporte de alguien que se ha jugado acercarse a un edificio inestable. */
    await conCiudad(page, 'pereira-2')
    await page.goto('/danos')
    await page.waitForSelector('.page-header__title', { timeout: 45_000 })

    const enlace = page.getByRole('link', { name: /reportar un daño/i })
    await expect(enlace).toHaveAttribute('href', /pereiraresponde\.co/)
    await expect(enlace).toHaveAttribute('target', '_blank')

    // Nada que se parezca a un formulario de publicación en esta pantalla.
    expect(await page.locator('main form').count()).toBe(0)
  })

  test('sin municipio ni ubicación no se promete ningún radio', async ({ page }) => {
    // Mismo criterio que el mapa de la ayuda: sin origen no hay distancias, y
    // un selector de radio que no recorta nada es una cercanía inventada.
    await page.goto('/danos')
    await esperarTarjetas(page)

    const cabecera = await page.locator('.page-header').innerText()
    expect(cabecera).not.toMatch(/a menos de \d+ km/i)

    const radios = await page.locator('.chip').filter({ hasText: /^\d+ km$/ }).count()
    expect(radios).toBe(0)
  })

  test('si la fuente falla, se dice; no se enseña "no hay daños"', async ({ page }) => {
    /* Presentar un 500 como una ciudad intacta es desinformar en plena
       emergencia: es exactamente la misma regla que ya cumple Corag. */
    await page.route(RUTA_API, (ruta) =>
      ruta.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"caído"}' }),
    )

    await conCiudad(page, 'pereira-2')
    await page.goto('/danos')
    /* Se espera al código de soporte, que solo lo pinta `AvisoError`. Esperar a
       un `.notice` cualquiera pasaría de largo: el aviso del 123 está desde el
       primer fotograma. Y hay margen de sobra porque un 5xx se reintenta dos
       veces antes de darse por perdido. */
    await page.waitForSelector('.codigo-soporte', { timeout: 60_000 })

    const texto = await page.locator('main').innerText()
    expect(texto).toMatch(/servidor|conexión|no pudimos/i)
    // Ni un cero presentado como buena noticia.
    expect(await page.locator('.card').count()).toBe(0)
  })

  test('avisa cuando la lista puede venir recortada por el tope de la API', async ({ page }) => {
    /* La API no pagina: si devuelve justo el tope, no hay forma de pedir el
       resto. Enseñar 500 como si fueran todos escondería una ciudad entera. */
    const reporte = (id: number) => ({
      id: String(id),
      type: 'housing',
      category: null,
      risk: 'high',
      title: 'Colapso total',
      area: 'Ubicación registrada',
      coords: [4.8143 + id * 0.00001, -75.6946],
      createdAt: new Date().toISOString(),
      photos: [],
      score: 0,
      votes: 0,
      userVote: 0,
    })

    await page.route(RUTA_API, (ruta) =>
      ruta.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reports: Array.from({ length: 500 }, (_, i) => reporte(i + 1)) }),
      }),
    )

    await conCiudad(page, 'pereira-2')
    await page.goto('/danos')
    await esperarTarjetas(page)

    const texto = await page.locator('main').innerText()
    expect(texto).toMatch(/puede haber más sin mostrar/i)
  })
})
