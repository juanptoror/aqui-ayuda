/**
 * Comprueba y captura los sellos de procedencia: cada tarjeta debe declarar de
 * qué backend viene el dato que muestra.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5180'
const DESTINO = path.resolve('capturas-viewport')
await mkdir(DESTINO, { recursive: true })

const navegador = await chromium.launch()

const CASOS = [
  { nombre: 'sellos-centros', url: '/ciudad/dosquebradas', origen: 'ayudas-pereira', scroll: 780 },
  { nombre: 'sellos-corag', url: '/ayuda-directa', origen: 'corag', scroll: 520 },
]

for (const caso of CASOS) {
  const ctx = await navegador.newContext({
    viewport: { width: 1440, height: 1050 },
    colorScheme: 'light',
  })
  const page = await ctx.newPage()
  await page.goto(BASE + caso.url, { waitUntil: 'domcontentloaded' })

  try {
    await page.waitForSelector('.card__title', { timeout: 25_000 })
  } catch {
    console.log(`${caso.nombre}: sin tarjetas (la fuente puede estar caída)`)
    await page.screenshot({ path: path.join(DESTINO, `${caso.nombre}.png`) })
    await ctx.close()
    continue
  }

  await page.waitForTimeout(900)
  await page.evaluate((y) => window.scrollTo(0, y), caso.scroll)
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(DESTINO, `${caso.nombre}.png`) })

  const propios = await page.locator(`.sello-fuente[data-origen="${caso.origen}"]`).count()
  const ajenos = await page
    .locator(`.sello-fuente:not([data-origen="${caso.origen}"])`)
    .count()
  console.log(`ok ${caso.nombre}: ${propios} sellos "${caso.origen}", ${ajenos} de otra fuente`)

  await ctx.close()
}

await navegador.close()
