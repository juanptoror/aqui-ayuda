/** Capturas de la pantalla de ayuda directa y su formulario de publicación. */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5180'
const DESTINO = path.resolve('capturas-interaccion')
await mkdir(DESTINO, { recursive: true })

const navegador = await chromium.launch()

for (const v of [
  { nombre: '1440', width: 1440, height: 1000, tema: 'light' },
  { nombre: '375', width: 375, height: 812, tema: 'dark' },
]) {
  const ctx = await navegador.newContext({
    viewport: { width: v.width, height: v.height },
    colorScheme: v.tema,
  })
  await ctx.addInitScript(
    ([t]) => {
      try {
        localStorage.setItem('ac.theme', t)
        // Ubicación fijada para ver el filtro por radio y las distancias.
        localStorage.setItem('ac.ubicacion', JSON.stringify({ lat: 4.834, lng: -75.6733 }))
      } catch {
        /* sin almacenamiento */
      }
    },
    [v.tema],
  )
  const page = await ctx.newPage()

  await page.goto(`${BASE}/ayuda-directa`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.card__title', { timeout: 25_000 })
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(DESTINO, `corag-lista-${v.nombre}.png`) })
  console.log(`ok corag-lista-${v.nombre}`)

  await page.getByRole('button', { name: 'Publicar' }).first().click()
  await page.waitForSelector('.sheet')
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(DESTINO, `corag-form-${v.nombre}.png`) })
  console.log(`ok corag-form-${v.nombre}`)

  await ctx.close()
}

await navegador.close()
