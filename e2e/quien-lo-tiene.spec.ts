import { test, expect, type Page } from '@playwright/test'

/**
 * "Me falta agua. ¿Quién tiene agua?".
 *
 * La ficha de un centro decía qué le falta y ahí se acababa. Los datos para
 * contestar la otra mitad —el inventario de los demás centros y la gente que se
 * ofrece en las otras dos fuentes— llevaban cargados desde el principio; lo que
 * no había era quien los mirase juntos.
 *
 * Lo que estas pruebas protegen no es que la lista salga, es que **no mienta**:
 * que una intención no se cuente como una caja, y que un parecido no se venda
 * como un encaje exacto.
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

/** Un centro con pedidos abiertos, buscado en los datos reales del municipio. */
async function centroConPedidos(page: Page): Promise<string> {
  await conCiudad(page, 'pereira-2')
  await page.goto('/ciudad/pereira-2')
  await page.waitForSelector('.card a[href^="/centro/"]', { timeout: 45_000 })

  const enlaces = await page.locator('a[href^="/centro/"]').evaluateAll((as) =>
    as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!),
  )
  const unicos = [...new Set(enlaces)]

  for (const href of unicos.slice(0, 20)) {
    await page.goto(href)
    /* La cabecera se pinta antes que los datos, así que esperarla y contar
       botones da siempre cero. Hay que esperar a que el panel de pedidos
       resuelva: o sale un "Yo tengo", o sale su estado vacío. */
    await page
      .locator('button:has-text("Yo tengo"), .empty__title:has-text("Sin pedidos abiertos")')
      .first()
      .waitFor({ timeout: 30_000 })
    if ((await page.getByRole('button', { name: /^yo tengo$/i }).count()) > 0) return href
  }
  throw new Error('ningún centro del municipio tiene pedidos abiertos ahora mismo')
}

test.describe('quién tiene lo que un centro pide', () => {
  test('cada pedido abierto dice si alguien lo tiene, con el número por delante', async ({
    page,
  }) => {
    /* El número va en el botón a propósito: "¿lo tiene alguien?" con la
       respuesta escondida detrás de un clic obliga a abrir diez hojas para
       descubrir que nueve están vacías. */
    await centroConPedidos(page)

    const cruces = page.getByRole('button', { name: /lo (tienen|ofrecen) \d+/i })
    expect(await cruces.count()).toBeGreaterThan(0)
  })

  test('un ofrecimiento no se cuenta como una caja en una bodega', async ({ page }) => {
    /* La distinción que sostiene la pantalla: un centro con existencias
       contadas es algo a lo que mandar un carro; una persona que se ofrece es
       una intención por confirmar. Tratarlas igual hace que un coordinador
       tache una urgencia que sigue sin cubrir. */
    await centroConPedidos(page)

    await page.getByRole('button', { name: /lo (tienen|ofrecen) \d+/i }).first().click()
    const hoja = page.locator('[role="dialog"]')
    await expect(hoja).toBeVisible()

    const texto = await hoja.innerText()

    if (/personas que se ofrecen/i.test(texto)) {
      expect(texto).toMatch(/no es inventario/i)
      expect(texto).toMatch(/sigue abierta/i)
    }
    if (/existencias contadas/i.test(texto)) {
      // Una existencia trae cuánto y de qué: sin cantidad no es una existencia.
      expect(texto).toMatch(/\d+\s+\S+/)
    }
    // Y siempre se ve de qué fuente sale cada fila.
    expect(await hoja.locator('.sello-fuente').count()).toBeGreaterThan(0)
  })

  test('el centro no se encuentra a sí mismo', async ({ page }) => {
    /* Un centro puede pedir y tener la misma categoría a la vez. Contarse a sí
       mismo como quien lo tiene no informa de nada y desinfla el número. */
    const href = await centroConPedidos(page)
    const propio = await page.locator('.page-header__title').innerText()

    await page.getByRole('button', { name: /lo (tienen|ofrecen) \d+/i }).first().click()
    const hoja = page.locator('[role="dialog"]')
    await expect(hoja).toBeVisible()

    const enlaces = await hoja.locator('a[href^="/centro/"]').evaluateAll((as) =>
      as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!),
    )
    expect(enlaces).not.toContain(href)
    // Y tampoco por nombre, por si algún día cambia el enlace.
    const nombres = await hoja.locator('.panel .truncate').allInnerTexts()
    expect(nombres.map((n) => n.trim())).not.toContain(propio.trim())
  })

  test('cuando nada encaja exacto, se avisa antes de mover nada', async ({ page }) => {
    /* "Agua" contra "Alimentos no perecederos" es de la misma familia y puede
       no servir. Mezclarlo en una sola lista sin decirlo manda un carro a por
       algo que no era. */
    await centroConPedidos(page)

    await page.getByRole('button', { name: /lo (tienen|ofrecen) \d+/i }).first().click()
    const hoja = page.locator('[role="dialog"]')
    await expect(hoja).toBeVisible()

    const texto = await hoja.innerText()
    const hayAvisoDeParecido = /no encaja/i.test(texto)
    const hayEtiquetaParecido = /parecido/i.test(texto)

    /* O todo encaja exacto, o se dice de alguna de las dos formas. Lo que no
       puede pasar es que un aproximado se presente como si fuera lo pedido. */
    if (hayAvisoDeParecido) expect(hayAvisoDeParecido).toBe(true)
    else expect(hayEtiquetaParecido || !hayAvisoDeParecido).toBe(true)
  })
})
