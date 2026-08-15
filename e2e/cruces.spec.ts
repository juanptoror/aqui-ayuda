import { test, expect, type Page } from '@playwright/test'

/**
 * El cruce entre los dos backends.
 *
 * Se prueba el comportamiento observable, no la tabla de equivalencias por
 * dentro: lo que importa es que a quien pide medicamentos se le diga dónde
 * hay, y que a quien pide un camión no se le ofrezcan cajas.
 */

async function abrirAyudaDirecta(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ac.ubicacion', JSON.stringify({ lat: 4.834, lng: -75.6733 }))
    } catch {
      /* sin almacenamiento */
    }
  })
  await page.goto('/ayuda-directa')
  await page.waitForSelector('.card__title', { timeout: 45_000 })
  // El cruce necesita centros e inventario, que llegan tras las peticiones.
  await page.waitForSelector('.cruce', { timeout: 30_000 })
}

test.describe('cruce con el inventario de los centros', () => {
  test('a quien pide algo material se le dice qué centro lo tiene y a qué distancia', async ({
    page,
  }) => {
    await abrirAyudaDirecta(page)

    const cruces = page.locator('.cruce')
    expect(await cruces.count()).toBeGreaterThan(0)

    const primero = await cruces.first().innerText()
    // Nombre del centro, cantidad con unidad y distancia: sin los tres, la
    // sugerencia no sirve para decidir si merece la pena ir.
    expect(primero).toMatch(/ESTO LO TIENEN CERCA|HAY ALGO PARECIDO CERCA/i)
    expect(primero, 'falta la cantidad').toMatch(/\d+\s+\w+/)
    expect(primero, 'falta la distancia').toMatch(/a\s[\d.,]+\s*(m|km)/)

    // Cada centro sugerido enlaza a su ficha.
    await expect(cruces.first().locator('a').first()).toHaveAttribute('href', /\/centro\//)
  })

  test('lo que no es material no se cruza con inventario', async ({ page }) => {
    await abrirAyudaDirecta(page)

    // Transporte y voluntariado son servicios: nadie guarda "cajas de
    // voluntariado" en una bodega, así que no deben recibir sugerencias.
    for (const servicio of ['transporte', 'voluntariado']) {
      const tarjetas = page.locator('.card', {
        has: page.locator('.badge', { hasText: new RegExp(`^${servicio}$`, 'i') }),
      })
      const total = await tarjetas.count()
      for (let i = 0; i < total; i++) {
        await expect(
          tarjetas.nth(i).locator('.cruce'),
          `una petición de ${servicio} no debería sugerir inventario`,
        ).toHaveCount(0)
      }
    }
  })

  test('el resumen dice cuántas peticiones tienen respuesta cerca', async ({ page }) => {
    await abrirAyudaDirecta(page)

    const aviso = page.locator('.notice', { hasText: /pueden cubrir|puede cubrir/ })
    await expect(aviso).toBeVisible()

    // El número del aviso coincide con las tarjetas que muestran cruce.
    const texto = await aviso.innerText()
    const anunciadas = Number(texto.match(/(\d+)\s+petici/)?.[1] ?? -1)
    expect(anunciadas).toBeGreaterThan(0)
    expect(anunciadas).toBe(await page.locator('.cruce').count())
  })
})
