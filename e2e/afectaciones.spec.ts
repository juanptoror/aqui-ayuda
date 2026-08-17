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
    await page.goto('/afectaciones')
    await esperarTarjetas(page)

    expect(urls.length).toBeGreaterThan(0)
    for (const u of urls) expect(u).toContain('limit=500')
  })

  test('la lista no carga ninguna foto; la ficha carga la suya y solo la suya', async ({
    page,
  }) => {
    /* Entre 3 y 7 MB por imagen, sin miniatura, y 179 reportes con foto: una
       rejilla que las cargue sola son cientos de megas sobre la red de una
       ciudad que acaba de temblar. Al abrir un daño sí se carga —quien abre el
       detalle viene a verla— pero UNA, la que se está mirando: con tres fotos,
       traerlas todas de golpe triplica la factura para enseñar una. */
    const fotos: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/photos/')) fotos.push(r.url())
    })

    await conCiudad(page, 'pereira-2')
    await page.goto('/afectaciones')
    await esperarTarjetas(page)
    await page.waitForTimeout(2500)

    expect(fotos, 'la lista no debe descargar ninguna foto').toHaveLength(0)

    await page.getByRole('button', { name: /ver el daño/i }).first().click()
    await page.waitForSelector('[role="dialog"] img', { timeout: 30_000 })
    await page.waitForTimeout(1200)

    expect(fotos.length).toBe(1)
  })

  test('el relleno "Ubicación registrada" no llega a la pantalla', async ({ page }) => {
    /* El esquema llama `area` a ese campo y lo ejemplifica como "Barrio Boston",
       pero es la nota opcional del formulario: 163 de 180 traen ese relleno.
       Pintarlo sería inventarle una dirección al reporte. */
    await conCiudad(page, 'pereira-2')
    await page.goto('/afectaciones')
    await esperarTarjetas(page)

    const texto = await page.locator('main').innerText()
    expect(texto).not.toContain('Ubicación registrada')
  })

  test('cada tarjeta lleva el sello de su fuente y ninguna otra', async ({ page }) => {
    await conCiudad(page, 'pereira-2')
    await page.goto('/afectaciones')
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
    await page.goto('/afectaciones')
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
    await page.goto('/afectaciones')
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

  test('la ficha enseña la foto sin un segundo clic, y avisa de lo que pesa', async ({ page }) => {
    /* La foto estuvo detrás de un botón por su peso. Se quitó porque quien abre
       el detalle de un edificio agrietado viene justo a verla: era fricción
       para algo que se iba a pulsar siempre. El aviso se queda, que informar no
       cuesta un clic. */
    await conCiudad(page, 'pereira-2')
    await page.goto('/afectaciones')
    await page.waitForSelector('.mapa__punto--dano', { timeout: 45_000 })

    await page.locator('.mapa__punto--dano').first().click({ force: true })
    await page.getByRole('button', { name: /ver el daño/i }).first().click()

    const ficha = page.locator('[role="dialog"]')
    await expect(ficha.locator('img')).toBeVisible({ timeout: 30_000 })
    await expect(ficha).toContainText(/pesa varios megas/i)
  })

  test('la tarjeta ofrece una sola puerta al detalle, no dos iguales', async ({ page }) => {
    /* Había "Ver el daño" y "Ver la foto". Desde que la ficha abre con la foto
       puesta hacen lo mismo, y dos botones para una acción es una decisión que
       no existe. */
    await conCiudad(page, 'pereira-2')
    await page.goto('/afectaciones')
    await esperarTarjetas(page)

    const primera = page.locator('.card').first()
    expect(await primera.getByRole('button').count()).toBe(1)
    await expect(primera.getByRole('button')).toContainText(/ver el daño/i)
  })

  test('sin clave configurada, reportar sale a la fuente en vez de fallar', async ({ page }) => {
    /* La escritura necesita una API key que vive en el servidor. Si no está,
       un formulario propio recogería la foto de alguien que se ha jugado
       acercarse a un edificio inestable y la perdería al enviar. */
    await page.route('**/api/reportes', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"disponible":false}' }),
    )

    await conCiudad(page, 'pereira-2')
    await page.goto('/afectaciones')
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
    await page.goto('/afectaciones')
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
    await page.goto('/afectaciones')
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
    await page.goto('/afectaciones')
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

  test('un corte de servicio no sale rotulado como edificio dañado', async ({ page }) => {
    /* `utility` —luz, agua, gas, internet, postes— llegó a la fuente después que
       los otros tres tipos. Mientras no estuvo en el mapeador, cada corte caía
       en el respaldo `?? 'vivienda'` y aparecía como "Edificio": decirle a
       alguien que hay un daño estructural donde lo único que pasa es que no hay
       luz. Se fija con datos propios para que la prueba no dependa de que hoy
       haya un corte reportado en Pereira. */
    await page.route(RUTA_API, (ruta) =>
      ruta.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reports: [
            {
              id: '183',
              type: 'utility',
              category: null,
              risk: 'utility',
              title: 'Sin servicio de internet',
              area: 'Movistar',
              coords: [4.8098, -75.66],
              createdAt: new Date().toISOString(),
              // Sin foto: el contrato la deja opcional justo en este tipo.
              photos: [],
              score: 0,
              votes: 0,
              userVote: 0,
            },
          ],
        }),
      }),
    )

    await conCiudad(page, 'pereira-2')
    await page.goto('/afectaciones')
    await esperarTarjetas(page)

    const tarjeta = page.locator('.card').first()
    await expect(tarjeta).toContainText(/servicio público/i)
    await expect(tarjeta, 'un corte de luz no es un edificio dañado').not.toContainText(/edificio/i)

    // Y tiene chip propio: mezclarlo con los servicios abiertos —sitios que
    // siguen atendiendo— sería juntar lo que funciona con lo que se cayó.
    await expect(page.locator('.chip').filter({ hasText: /^Servicios públicos$/ })).toBeVisible()
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
    await page.goto('/afectaciones')
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
    await page.goto('/afectaciones')
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
    await hoja.getByRole('button', { name: /centrar donde estoy/i }).click()
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

  test('un corte de servicio se publica como `utility` y sin exigir foto', async ({ page }) => {
    /* Dos reglas del contrato a la vez: `utility` exige `risk: "utility"` —otra
       combinación son 400 y un envío gastado— y es el único tipo con
       `photos.minItems: 0`. Pedir foto igual dejaría sin publicar justo a quien
       está a oscuras, que es quien menos tiene que enseñar. */
    let enviado: Record<string, unknown> | null = null
    const hoja = await conFormulario(page, (c) => {
      enviado = c as Record<string, unknown>
    })

    await hoja.getByRole('tab', { name: 'Servicio público' }).click()
    // La gravedad sigue siendo cosa de los edificios, y la categoría de los sitios.
    await expect(hoja.getByRole('tab', { name: /riesgo alto/i })).toHaveCount(0)
    await expect(hoja.locator('#categoria')).toHaveCount(0)
    await expect(hoja).toContainText(/opcional aquí/i)

    await hoja.locator('#clase').selectOption('Sin servicio de luz')
    await hoja.getByRole('button', { name: /centrar donde estoy/i }).click()
    await expect(hoja.locator('.num')).toContainText('4.81430', { timeout: 20_000 })

    const publicar = hoja.getByRole('button', { name: /publicar el reporte/i })
    await expect(publicar, 'sin una sola foto tiene que poder enviarse').toBeEnabled({
      timeout: 15_000,
    })
    await publicar.click()
    await expect(hoja).toContainText(/reporte publicado/i, { timeout: 20_000 })

    expect(enviado).not.toBeNull()
    const c = enviado as unknown as Record<string, unknown>
    expect(c.type).toBe('utility')
    expect(c.risk).toBe('utility')
    expect(c.category).toBeNull()
    expect(c.photos).toEqual([])
  })

  test('el punto que se publica es el que se señala, no donde está el teléfono', async ({
    page,
  }) => {
    /* Reportar bien exige apartarse del edificio, y apartarse mueve el GPS a la
       acera de enfrente o al portal del vecino. En un mapa de peligros eso manda
       a alguien a rodear la manzana equivocada, así que el GPS solo centra el
       mapa y el pin lo pone quien reporta. */
    let enviado: Record<string, unknown> | null = null
    const hoja = await conFormulario(page, (c) => {
      enviado = c as Record<string, unknown>
    })

    await hoja.locator('#clase').selectOption('Colapso total')
    await hoja.getByRole('button', { name: /centrar donde estoy/i }).click()
    await expect(hoja.locator('.num')).toContainText('4.81430', { timeout: 20_000 })

    const mapa = hoja.locator('.mapa--elegir')
    await expect(mapa, 'sin mapa no se puede afinar el punto').toBeVisible({ timeout: 30_000 })
    await expect(hoja.locator('.mapa__pin-elegir')).toBeVisible()

    /* Se pincha por coordenadas porque Leaflet escucha en el contenedor, no en
       un elemento con rol. Hay que asegurarse antes de que el mapa esté entero
       dentro de la hoja: medio fuera, el clic cae en el fondo y la cierra. */
    await mapa.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    const caja = await mapa.boundingBox()
    if (!caja) throw new Error('el mapa no tiene caja')
    await page.mouse.click(caja.x + caja.width * 0.3, caja.y + caja.height * 0.3)
    await expect(hoja.locator('.num')).not.toContainText('4.81430', { timeout: 10_000 })

    await hoja
      .locator('input[type="file"]')
      .setInputFiles({ name: 'grieta.png', mimeType: 'image/png', buffer: PNG })
    await expect(hoja.getByRole('button', { name: /publicar el reporte/i })).toBeEnabled({
      timeout: 15_000,
    })
    await hoja.getByRole('button', { name: /publicar el reporte/i }).click()
    await expect(hoja).toContainText(/reporte publicado/i, { timeout: 20_000 })

    // Lo publicado es el punto señalado, no el del GPS.
    const coords = (enviado as unknown as { coords: [number, number] }).coords
    expect(coords[0]).not.toBe(4.8143)
    expect(coords[1]).not.toBe(-75.6946)
    // Pero sigue siendo Pereira: mover el pin no puede sacarlo de la ciudad.
    expect(coords[0]).toBeGreaterThan(4.7)
    expect(coords[0]).toBeLessThan(4.95)
    expect(coords[1]).toBeGreaterThan(-75.85)
    expect(coords[1]).toBeLessThan(-75.55)
  })

  test('la foto se envía reducida y sin el prefijo que el contrato prohíbe', async ({ page }) => {
    /* Dos cosas a la vez: el contrato pide los bytes pelados en Base64, y una
       foto de teléfono sin reducir no cabe en el límite de la función. */
    let enviado: Record<string, unknown> | null = null
    const hoja = await conFormulario(page, (c) => {
      enviado = c as Record<string, unknown>
    })

    await hoja.locator('#clase').selectOption('Colapso total')
    await hoja.getByRole('button', { name: /centrar donde estoy/i }).click()
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
    await hoja.getByRole('button', { name: /centrar donde estoy/i }).click()
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
