/**
 * Comprueba el cruce entre backends: cuántas peticiones de Corag puede cubrir
 * un centro de Ayudas Pereira, y captura el resultado.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5180'
const DESTINO = path.resolve('capturas-viewport')
await mkdir(DESTINO, { recursive: true })

const navegador = await chromium.launch()
const ctx = await navegador.newContext({
  viewport: { width: 1440, height: 1100 },
  colorScheme: 'light',
})
// Ubicación en Dosquebradas: sin ella no hay distancias que mostrar.
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('ac.ubicacion', JSON.stringify({ lat: 4.834, lng: -75.6733 }))
    localStorage.setItem('ac.ciudad', 'dosquebradas')
  } catch {
    /* sin almacenamiento */
  }
})

const page = await ctx.newPage()
await page.goto(`${BASE}/ayuda-directa`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.card__title', { timeout: 45_000 })

// El cruce necesita centros e inventario, que llegan después de las peticiones.
await page.waitForTimeout(6000)

const tarjetas = await page.locator('.card__title').count()
const cruces = await page.locator('.cruce').count()
const lineas = await page.locator('.cruce__lista li').count()

console.log(`peticiones:      ${tarjetas}`)
console.log(`con cruce:       ${cruces}`)
console.log(`centros sugeridos: ${lineas}`)

if (cruces > 0) {
  const ejemplo = await page.locator('.cruce').first().innerText()
  console.log(`\nejemplo:\n${ejemplo}`)
  await page.locator('.cruce').first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
}

await page.screenshot({ path: path.join(DESTINO, 'cruce-backends.png') })
console.log('\nok cruce-backends.png')

await navegador.close()
process.exit(cruces > 0 ? 0 : 1)
