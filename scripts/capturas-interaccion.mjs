/**
 * Capturas de estados que solo existen tras interactuar: el diálogo del
 * selector (centrado en escritorio, hoja inferior en móvil) y los estados
 * vacíos diseñados.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = 'http://localhost:5180'
const DESTINO = path.resolve('capturas-interaccion')
await mkdir(DESTINO, { recursive: true })

const navegador = await chromium.launch()

async function conContexto(nombre, width, height, colorScheme, fn) {
  const ctx = await navegador.newContext({
    viewport: { width, height },
    colorScheme,
  })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('ac.ciudad', 'dosquebradas')
    } catch {
      /* sin almacenamiento */
    }
  })
  const page = await ctx.newPage()
  await fn(page, nombre)
  await ctx.close()
}

// 1. Diálogo centrado en escritorio.
await conContexto('dialogo-1440', 1440, 900, 'light', async (page, nombre) => {
  await page.goto(`${BASE}/ciudad/dosquebradas`)
  await page.waitForSelector('.page-header__title')
  // Se acota a la cabecera: en móvil el botón se llama solo "Cambiar" (la
  // palabra "municipio" se oculta para que quepan dos acciones en una fila).
  await page.locator('.page-header__actions').getByRole('button', { name: /^Cambiar/ }).click()
  await page.waitForSelector('.sheet')
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(DESTINO, `${nombre}.png`) })
  console.log(`ok ${nombre}`)
})

// 2. Hoja inferior en móvil.
await conContexto('hoja-375', 375, 812, 'light', async (page, nombre) => {
  await page.goto(`${BASE}/ciudad/dosquebradas`)
  await page.waitForSelector('.page-header__title')
  // Se acota a la cabecera: en móvil el botón se llama solo "Cambiar" (la
  // palabra "municipio" se oculta para que quepan dos acciones en una fila).
  await page.locator('.page-header__actions').getByRole('button', { name: /^Cambiar/ }).click()
  await page.waitForSelector('.sheet')
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(DESTINO, `${nombre}.png`) })
  console.log(`ok ${nombre}`)
})

// 3. Estado vacío: filtro de categoría sin resultados.
await conContexto('vacio-filtro-1440', 1440, 1000, 'light', async (page, nombre) => {
  await page.goto(`${BASE}/ciudad/dosquebradas`)
  await page.waitForSelector('.page-header__title')
  // Modo "necesito ayuda" + filtro de una categoría que nadie tiene en stock.
  await page.getByRole('tab', { name: 'Quiero ayudar' }).click()
  const chip = page.locator('.chip').last()
  await chip.click()
  await page.getByRole('tab', { name: 'Necesito ayuda' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(DESTINO, `${nombre}.png`), fullPage: true })
  console.log(`ok ${nombre}`)
})

// 4. Estado vacío: municipio inexistente.
await conContexto('vacio-404-375', 375, 812, 'dark', async (page, nombre) => {
  await page.goto(`${BASE}/ciudad/municipio-que-no-existe`)
  await page.waitForSelector('.empty__title')
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(DESTINO, `${nombre}.png`), fullPage: true })
  console.log(`ok ${nombre}`)
})

// 5. Ficha de un centro real: se llega haciendo clic en la primera tarjeta,
//    así la captura no depende de un id concreto que puede desaparecer.
for (const v of [
  { nombre: 'centro-1440', width: 1440, height: 1200, tema: 'light', completa: true },
  { nombre: 'centro-375', width: 375, height: 812, tema: 'dark', completa: false },
]) {
  await conContexto(v.nombre, v.width, v.height, v.tema, async (page, nombre) => {
    await page.goto(`${BASE}/ciudad/dosquebradas`)
    await page.waitForSelector('.card__title', { timeout: 20_000 })
    await page.locator('.card__link').first().click()
    await page.waitForURL(/\/centro\//)
    await page.waitForSelector('.page-header__title')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(900)
    await page.screenshot({ path: path.join(DESTINO, `${nombre}.png`), fullPage: v.completa })
    console.log(`ok ${nombre}`)
  })
}

// 6. Estado de carga (esqueletos) con la red frenada.
await conContexto('carga-1440', 1440, 1000, 'light', async (page, nombre) => {
  await page.route('**/rest/v1/**', async (ruta) => {
    await new Promise((r) => setTimeout(r, 6000))
    await ruta.continue()
  })
  await page.goto(`${BASE}/ciudad/dosquebradas`)
  await page.waitForSelector('.skeleton')
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(DESTINO, `${nombre}.png`) })
  console.log(`ok ${nombre}`)
})

await navegador.close()
console.log(`\nCapturas en: ${DESTINO}`)
