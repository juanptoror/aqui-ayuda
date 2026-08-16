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

  test('tocar un punto del mapa lleva a su ficha, no a un callejón sin salida', async ({
    page,
  }) => {
    /* Durante un rato solo los centros de acopio tenían "Ver ficha": se tocaba
       una persona o un daño y no había forma de ver nada más que el título,
       con la mitad del dato —gravedad, nota, confirmaciones, foto— dentro y sin
       manera de mirarlo. */
    await conCiudad(page, 'pereira-2')
    await page.goto('/danos')
    await page.waitForSelector('.mapa__punto--dano', { timeout: 45_000 })

    await page.locator('.mapa__punto--dano').first().click({ force: true })

    const accion = page.getByRole('button', { name: /ver el daño/i }).first()
    await expect(accion).toBeVisible()
    await accion.click()

    const ficha = page.locator('[role="dialog"]')
    await expect(ficha).toBeVisible()
    // Y trae lo que la tarjeta no cabía: el aviso de no acercarse y el recuento
    // de confirmaciones, no solo el título repetido.
    await expect(ficha).toContainText(/123/)
    await expect(ficha).toContainText(/confirm/i)
  })

  test('abrir la ficha desde el mapa no descarga la foto de 5 MB', async ({ page }) => {
    /* La ficha se abre tocando un punto, y eso nadie lo hace pensando en
       gastarse los datos del mes. El permiso lo da el botón, no el gesto. */
    const fotos: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/photos/')) fotos.push(r.url())
    })

    await conCiudad(page, 'pereira-2')
    await page.goto('/danos')
    await page.waitForSelector('.mapa__punto--dano', { timeout: 45_000 })

    await page.locator('.mapa__punto--dano').first().click({ force: true })
    await page.getByRole('button', { name: /ver el daño/i }).first().click()
    await page.waitForSelector('[role="dialog"]', { timeout: 15_000 })
    await page.waitForTimeout(1500)

    expect(fotos).toHaveLength(0)
    expect(await page.locator('[role="dialog"] img').count()).toBe(0)
    // Pero se ofrece, con el peso por delante.
    await expect(
      page.locator('[role="dialog"]').getByRole('button', { name: /ver .*(foto|fotos)/i }),
    ).toBeVisible()
  })

  test('sin clave configurada, reportar sale a la fuente en vez de fallar', async ({ page }) => {
    /* La escritura necesita una API key que vive en el servidor. Si no está,
       un formulario propio recogería la foto de alguien que se ha jugado
       acercarse a un edificio inestable y la perdería al enviar. */
    await page.route('**/api/reportes', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"disponible":false}' }),
    )

    await conCiudad(page, 'pereira-2')
    await page.goto('/danos')
    await page.waitForSelector('.page-header__title', { timeout: 45_000 })

    const enlace = page.getByRole('link', { name: /reportar un daño/i })
    await expect(enlace).toHaveAttribute('href', /pereiraresponde\.co/)
    await expect(enlace).toHaveAttribute('target', '_blank')
  })

  test('la clave de escritura nunca viaja al navegador', async ({ page }) => {
    /* La documentación de la fuente lo dice con todas las letras: "nunca
       publiques la clave en JavaScript del navegador". Una variable `VITE_*` se
       hornea en el bundle, así que esta prueba vigila que nadie la mueva ahí
       "para simplificar": bastaría una vez para regalar la clave y su cuota. */
    await conCiudad(page, 'pereira-2')
    await page.goto('/danos')
    await page.waitForSelector('.page-header__title', { timeout: 45_000 })

    const rastro = await page.evaluate(async () => {
      const scripts = [...document.querySelectorAll('script[src]')].map(
        (s) => (s as HTMLScriptElement).src,
      )
      let todo = document.documentElement.outerHTML
      for (const src of scripts) {
        todo += await fetch(src)
          .then((r) => r.text())
          .catch(() => '')
      }
      return {
        mencionaLaVariable: /PEREIRA_RESPONDE_API_KEY/.test(todo),
        llevaCabeceraBearer: /Authorization[^\n]{0,40}Bearer/i.test(todo),
      }
    })

    expect(rastro.mencionaLaVariable).toBe(false)
    expect(rastro.llevaCabeceraBearer).toBe(false)
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

/**
 * Publicar un daño desde aquí.
 *
 * La escritura pasa por nuestra función de servidor, así que estas pruebas
 * fuerzan la respuesta de `/api/reportes` en vez de depender de si esta máquina
 * tiene clave configurada: lo que hay que fijar es el comportamiento, no el
 * entorno.
 */
test.describe('reportar un daño', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: 4.8143, longitude: -75.6946 },
  })

  /** Un PNG de 1x1: lo mínimo para que el navegador tenga algo que redimensionar. */
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )

  async function conFormulario(page: Page, alPublicar?: (cuerpo: unknown) => void) {
    await page.route('**/api/reportes', async (ruta) => {
      if (ruta.request().method() === 'POST') {
        alPublicar?.(JSON.parse(ruta.request().postData() ?? '{}'))
        await ruta.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: '999' }),
        })
        return
      }
      await ruta.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"disponible":true}',
      })
    })

    await conCiudad(page, 'pereira-2')
    await page.goto('/danos')
    await page.getByRole('button', { name: /reportar un daño/i }).click()
    await page.waitForSelector('[role="dialog"]', { timeout: 30_000 })
    return page.locator('[role="dialog"]')
  }

  test('no deja publicar sin clase, ubicación y foto, y dice cuál falta', async ({ page }) => {
    /* Un botón apagado sin explicación es una pantalla que no contesta, y aquí
       quien la mira está en la calle con prisa. */
    const hoja = await conFormulario(page)

    const publicar = hoja.getByRole('button', { name: /publicar el reporte/i })
    await expect(publicar).toBeDisabled()
    await expect(hoja).toContainText(/para enviarlo falta/i)
    await expect(hoja).toContainText(/la clase de afectación/i)
    await expect(hoja).toContainText(/la ubicación/i)
    await expect(hoja).toContainText(/una foto/i)

    // Y el aviso de seguridad va arriba, no en la letra pequeña.
    await expect(hoja).toContainText(/no te acerques/i)
    await expect(hoja).toContainText(/123/)
  })

  test('el riesgo sale del tipo: nadie puede publicar una vía con gravedad alta', async ({
    page,
  }) => {
    /* La fuente responde 400 si la combinación no encaja, y ese 400 gasta uno de
       los cinco envíos por minuto de la clave. Aquí no se puede ni construir. */
    let enviado: Record<string, unknown> | null = null
    const hoja = await conFormulario(page, (c) => {
      enviado = c as Record<string, unknown>
    })

    await hoja.getByRole('tab', { name: 'Vía' }).click()
    // La gravedad solo existe en edificios: en vía no hay ni selector.
    await expect(hoja.getByRole('tab', { name: /riesgo alto/i })).toHaveCount(0)

    await hoja.locator('#clase').selectOption('Paso restringido')
    await hoja.getByRole('button', { name: /usar mi ubicación/i }).click()
    await expect(hoja.locator('.num')).toContainText('4.81430', { timeout: 20_000 })

    await hoja
      .locator('input[type="file"]')
      .setInputFiles({ name: 'via.png', mimeType: 'image/png', buffer: PNG })

    const publicar = hoja.getByRole('button', { name: /publicar el reporte/i })
    await expect(publicar).toBeEnabled({ timeout: 15_000 })
    await publicar.click()
    await expect(hoja).toContainText(/reporte publicado/i, { timeout: 20_000 })

    expect(enviado).not.toBeNull()
    const c = enviado as unknown as Record<string, unknown>
    expect(c.type).toBe('road')
    expect(c.risk).toBe('road')
    // `category` solo la llevan los servicios abiertos; en el resto va vacía.
    expect(c.category).toBeNull()
    expect(c.coords).toEqual([4.8143, -75.6946])
  })

  test('la foto se envía reducida y sin el prefijo que el contrato prohíbe', async ({ page }) => {
    /* Dos cosas a la vez: el contrato pide los bytes pelados en Base64, y una
       foto de teléfono sin reducir no cabe en el límite de la función. */
    let enviado: Record<string, unknown> | null = null
    const hoja = await conFormulario(page, (c) => {
      enviado = c as Record<string, unknown>
    })

    await hoja.locator('#clase').selectOption('Colapso total')
    await hoja.getByRole('button', { name: /usar mi ubicación/i }).click()
    await expect(hoja.locator('.num')).toContainText('4.81430', { timeout: 20_000 })
    await hoja
      .locator('input[type="file"]')
      .setInputFiles({ name: 'grieta.png', mimeType: 'image/png', buffer: PNG })

    await expect(hoja.getByRole('button', { name: /publicar el reporte/i })).toBeEnabled({
      timeout: 15_000,
    })
    await hoja.getByRole('button', { name: /publicar el reporte/i }).click()
    await expect(hoja).toContainText(/reporte publicado/i, { timeout: 20_000 })

    const fotos = (enviado as unknown as { photos: { contentType: string; data: string }[] }).photos
    expect(fotos).toHaveLength(1)
    // Sale en JPEG aunque entrara un PNG: es lo que comprime bien una fachada.
    expect(fotos[0].contentType).toBe('image/jpeg')
    expect(fotos[0].data.startsWith('data:')).toBe(false)
    expect(fotos[0].data).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
  })

  test('al publicar se dice que pasa por moderación, no que ya esté resuelto', async ({ page }) => {
    /* Publicar un reporte no avisa a nadie ni arregla nada. Dejar creer lo
       contrario a quien está delante de un edificio inclinado es lo peor que
       podría hacer esta pantalla. */
    const hoja = await conFormulario(page)

    await hoja.locator('#clase').selectOption('Colapso total')
    await hoja.getByRole('button', { name: /usar mi ubicación/i }).click()
    await expect(hoja.locator('.num')).toContainText('4.81430', { timeout: 20_000 })
    await hoja
      .locator('input[type="file"]')
      .setInputFiles({ name: 'grieta.png', mimeType: 'image/png', buffer: PNG })

    await expect(hoja.getByRole('button', { name: /publicar el reporte/i })).toBeEnabled({
      timeout: 15_000,
    })
    await hoja.getByRole('button', { name: /publicar el reporte/i }).click()

    await expect(hoja).toContainText(/moderación/i, { timeout: 20_000 })
    await expect(hoja).toContainText(/no avisa a nadie/i)
  })
})
